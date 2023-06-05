/* ----------------triggers------------------------
-------------------------------------------------*/

/*book triggers*/
delimiter $$
create trigger validate_publish_date
before insert on book
for each row
begin
    if new.publish_date > CURRENT_DATE() then
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Publish date cannot be in the future.';
    end if;
end$$
delimiter ;

delimiter $$
create trigger set_ISBN
before insert on book
for each row
begin
	if new.ISBN is null then
		set new.ISBN = generate_ISBN();
	end if;
end$$
delimiter ;

delimiter $$
create trigger copy_added
after insert on copy
for each row
begin
  DECLARE num_copies INT;
  SELECT COUNT(*) INTO num_copies FROM copy WHERE book_id = NEW.book_id;
  UPDATE book SET numbers_copy = num_copies WHERE book_id = NEW.book_id;
end$$
delimiter ;

/*moderator triggers*/

delimiter $$
create trigger available_position
before update on moderator
for each row
begin
	declare the_actives int;
    
    select count(*) into the_actives
    from moderator
    where school_id=new.school_id and verification=1;
    
    if (the_actives > 0 and new.verification = 1) then
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Try next time.';
    end if;
end$$
delimiter ;

/* rating triggers */

delimiter $$
create trigger set_verification before insert on rating
for each row
begin
	DECLARE user_role VARCHAR(50);
    SELECT role INTO user_role FROM user WHERE user_id = NEW.user_id;
    IF NEW.comment IS NULL THEN
		SET NEW.verification = 1;
    ELSE 
        IF user_role = 'teacher' THEN
            SET NEW.verification = 1;
        ELSE
            SET NEW.verification = 0;
        END IF;
    END IF;
end $$
delimiter $$

delimiter $$
create trigger avg_rating after insert on rating
for each row
begin
	declare average decimal(2,1);
    select avg(rating_stars) into average from rating r
	where r.book_id = new.book_id and r.verification = true;
    
    update book b
    set b.average_rating = average
    where b.book_id = new.book_id;
end $$
delimiter $$

delimiter $$
create trigger avg_rating_update after update on rating
for each row
begin
	declare average decimal(2,1);
    select avg(rating_stars) into average from rating r
	where r.book_id = new.book_id and r.verification = true;
    
    update book b
    set b.average_rating = average
    where b.book_id = new.book_id;
end $$
delimiter $$

delimiter $$
create trigger valid_opinion before insert on rating
for each row
begin
	DECLARE the_reads int;
    
    select count(*) into the_reads
    from rental
    where user_id=new.user_id and book_id=new.book_id and status in ('active', 'late', 'returned');
    
    if the_reads=0 then
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Give it a shot first.';
	end if;
end $$
delimiter $$

/* request triggers */

delimiter $$
create trigger insert_rental
after update on request
for each row
begin
    if new.status = 'accepted' then
        insert into rental (book_id, user_id) values (new.book_id, new.user_id);
    end if;
end$$
delimiter ;

delimiter $$
create trigger misclick
before update on request
for each row
begin
    if old.status <> 'pending' then
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You misclicked.';
    end if;
end$$
delimiter ;

/* returns triggers */

delimiter $$
CREATE TRIGGER validate_return_date
BEFORE INSERT ON returns
FOR EACH ROW
BEGIN
	declare the_day date;
    
	select r.take_date into the_day
	from rental r
	where r.rent_id = new.rent_id;
    
    IF NEW.return_date < the_day THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You went back to the future?';
    END IF;
END$$
delimiter ;

delimiter $$
CREATE TRIGGER check_error
BEFORE INSERT ON returns
FOR EACH ROW
BEGIN
	declare the_status enum('queued up', 'terminated', 'active', 'late', 'returned');
    
    select r.status into the_status
    from rental r where r.rent_id = new.rent_id;
    
    IF the_status not in ('active', 'late') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You sure you can return that?';
    END IF;
END$$
delimiter ;

delimiter $$
create trigger change_status_make_available_start_reserve after insert on returns
for each row
 begin 
 declare the_copy int;
 declare the_book int;
 declare the_reservations int;
 declare the_reservation int;
 declare the_school int;

 select u.school_id into the_school
 from rental r
		join user u on u.user_id = r.user_id
 where r.rent_id = new.rent_id;
    
 select r.copy_id into the_copy
 from rental r where r.rent_id = new.rent_id;
 
 select c.book_id into the_book
 from copy c where c.copy_id = the_copy;
 
 update rental set status = 'returned' where rent_id = new.rent_id;
 
 select count(*) into the_reservations
 from reservation res 
	join user u on u.user_id = res.user_id
 where res.book_id = the_book and res.status = 'on hold' and u.school_id = the_school;
 
 if the_reservations <> 0 then
	select res.rent_id into the_reservation
	from reservation res 
    	join user u on u.user_id = res.user_id
    where res.book_id = the_book and status = 'on hold' and u.school_id = the_school
    order by reservation_date limit 1;
    
    update reservation set status = 'active', reserved_for = curdate() where rent_id = the_reservation;
    update copy set status = 'reserved' where copy_id = the_copy;
 else
	update copy set status = 'available' where copy_id = the_copy;
 end if;
 
end$$
delimiter ;

/* rental-reservation triggers */

delimiter $$
create trigger book_a_book_or_on_hold before insert on rental
for each row 
begin
	declare available_copies int;
    declare total_copies int;
    declare the_school int;
    declare the_mod int;
    
    select school_id into the_school
	from user where user_id = new.user_id;
  
    select mod_id into the_mod
	from moderator m where m.school_id = the_school and m.verification = true;
	
    select count(*) into available_copies from copy c
	where c.book_id = new.book_id and c.school_id = the_school and c.status = 'available';
    
    select count(*) into total_copies from copy c
	where c.book_id = new.book_id and c.school_id = the_school;
    
    set new.mod_id = the_mod;
    
    if available_copies > 0 then
		set new.copy_id = (select min(c.copy_id)
						   from copy c
						   where c.book_id = new.book_id and c.school_id = the_school and c.status = 'available'
						   order by c.copy_id);
		set new.take_date = date(new.request_date);
		update copy set status = 'rented' where copy_id = new.copy_id;
	elseif total_copies > 0 then
		set new.status = 'queued up';
        set new.take_date = null;
        /*that that that we told*/
	else 
		signal sqlstate '45000' set message_text = 'Book not available';
	end if;
end$$
delimiter ;

delimiter $$
create trigger make_reserve after insert on rental
for each row
begin
	if new.status = 'queued up' then
		insert into reservation (rent_id, book_id, user_id, mod_id, reservation_date) 
        values (new.rent_id, new.book_id, new.user_id, new.mod_id, new.request_date);
    end if;
end$$
delimiter ;

delimiter $$
create trigger check_limit before insert on rental
for each row
begin 
  declare rentals int;
  declare user_role enum('teacher', 'student');  
  
  select role INTO user_role from user u where u.user_id = NEW.user_id;
  select count(*) into rentals
  from rental r
  where r.user_id = NEW.user_id and r.take_date > date_sub(now(), interval 1 week) and r.copy_id is not null; 
  
  if user_role = 'student' then /*student case*/
   
   if rentals >= 2  then
   SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'You have reached the limit of rentals for the week';
    end if;
  elseif user_role = 'teacher' then /*teacher case*/
   if rentals >= 1  then
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'You have reached the limit of rentals for the week';
	end if;
  end if;
end$$
delimiter ; 

delimiter $$
create trigger deny_double before insert on rental
for each row
begin
	declare double_rent int;
    
    select count(*) into double_rent
    from rental where user_id = new.user_id and book_id = new.book_id and status in ('active', 'queued up', 'late');
    
    if double_rent > 0 then
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You have an active rental/reservation of this book!';
	end if;
end$$
delimiter ;

delimiter $$
create trigger default_take_date before insert on rental
for each row
begin
	if new.take_date is null and new.status = 'active'
    then set new.take_date = curdate();
    end if;
end$$
delimiter;

delimiter $$
CREATE TRIGGER validate_res_date
BEFORE INSERT ON reservation
FOR EACH ROW
BEGIN
    IF NEW.reserved_for < CURRENT_DATE() and new.reserved_for is not null THEN 
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reservation date cannot be in the past.';
    END IF;
END$$
delimiter ;

delimiter $$
create trigger check_res_limit before insert on reservation
for each row
begin 
  declare reservations int;
  declare late_rental int;
  declare book_rented int;
  declare book_reserved int;
  declare user_role enum('teacher', 'student');
  
  select role into user_role from user where user_id = new.user_id;
  select count(*) into reservations
  from reservation 
  where user_id = NEW.user_id  
  and status in ('active', 'on hold') and date_sub(now(), interval 1 week) <= reservation_date;
 
  if user_role = 'student' then /*student case*/
    if reservations >= 2 then 
     SIGNAL SQLSTATE '45000'
       SET MESSAGE_TEXT = 'You have reached the limit of reservations for the week';
    end if;
  elseif user_role = 'teacher' then /* teacher case */ 

   if reservations >= 1 then
     SIGNAL SQLSTATE '45000'
       SET MESSAGE_TEXT = 'You have reached the limit of reservations for the week';
    end if; 
   end if;
  
  select count(*) into book_rented
  from rental
  where user_id = NEW.user_id and book_id = NEW.book_id and status in ('active', 'late');
  
  select count(*) into book_reserved
  from reservation
  where user_id = NEW.user_id and book_id = NEW.book_id and status in ('on hold', 'active');
  
  if book_rented <> 0 and book_reserved <> 0 then
   SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'You have rented this book already!';
  end if; 
  
  select count(*) into late_rental
  from rental 
  where user_id = NEW.user_id and status = 'late';
  
  if late_rental <> 0 then
     SIGNAL SQLSTATE '45000'
	 SET MESSAGE_TEXT = 'You have a rental that is late!';
  end if; 
end$$
delimiter ;

delimiter $$
create trigger activate_next_reservation
after update on rental
for each row
begin
	declare the_status enum('on hold', 'active', 'terminated', 'completed');
	declare the_school int;
    declare the_copy int;
    DECLARE the_next_reservation INT;
   
    select status into the_status
    from reservation where rent_id = new.rent_id;
   
	select school_id into the_school
	from user where user_id = new.user_id;

	select min(c.copy_id) into the_copy
	from copy c
	where c.book_id = new.book_id and c.school_id = the_school and c.status = 'reserved'
    order by c.copy_id;
    
	if (the_status = 'active' and NEW.status = 'terminated') then
		set the_next_reservation = (
			select r.rent_id
			from reservation r
				join user u on u.user_id = r.user_id
			where r.book_id = new.book_id and r.status = 'on hold' and u.school_id = the_school
            order by r.reservation_date asc
            limit 1
		);
        update reservation set status = 'terminated' where rent_id = new.rent_id;
        
        if the_next_reservation is not null then
			update reservation
            set status = 'active', reserved_for = curdate()
			where rent_id = the_next_reservation;
		else 
			update copy set status = 'available' where copy_id = the_copy;
		end if;
   end if;
end $$
delimiter ;

delimiter $$
create trigger update_rental
after update on reservation
for each row
begin
	declare the_school int;
    declare the_copy int;
    
    select school_id into the_school
	from user where user_id = new.user_id;

	select min(c.copy_id) into the_copy
	from copy c
	where c.book_id = new.book_id and c.school_id = the_school and c.status = 'reserved'
    order by c.copy_id;
    
   if (old.status = 'active' and NEW.status = 'completed') then
	update rental r
	set r.status = 'active', r.take_date = curdate(), r.copy_id = the_copy
	where r.rent_id = new.rent_id;
    update copy set status = 'rented' where copy_id = the_copy;
   end if;
end $$
delimiter ;

delimiter $$
create trigger check_priority
before update on reservation
for each row
begin
	IF (old.status <> 'active' and new.status in ('terminated','completed'))
		or (old.status in ('terminated','completed')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You misclicked!';
    END IF;
end $$
delimiter ;

/* ----------------events--------------------------
-------------------------------------------------*/

delimiter $$
create event cancel_reservation
on schedule every 12 hour
starts CURRENT_TIMESTAMP + interval 5 minute/*INTERVAL 12 HOUR/*12 at night*/
do
begin
   update reservation res
	join rental r on res.rent_id = r.rent_id
   set res.status = 'terminated', r.status = 'terminated' 
   where res.status = 'active' and res.reserved_for <= date_sub(now(), interval 1 week);
end $$
delimiter ;
ALTER EVENT cancel_reservation ENABLE;
SET GLOBAL event_scheduler = ON;

delimiter $$
create event check_for_latency
on schedule every 1 day
starts current_timestamp() + interval 5 minute
do
begin
	update rental set status = 'late' where status = 'active' 
										and date_add(take_date, interval 7 day) <= curdate();
end$$
delimiter ;
ALTER EVENT check_for_latency ENABLE;
SET GLOBAL event_scheduler = ON;

/* ----------------functions-----------------------
-------------------------------------------------*/
DELIMITER //
CREATE FUNCTION generate_ISBN() RETURNS VARCHAR(17) deterministic
  BEGIN
      DECLARE core INT;
      DECLARE prefix VARCHAR(3);
      DECLARE str_core VARCHAR(9);
      DECLARE check_digit INT;
      DECLARE sum INT;
      DECLARE check_digit_str VARCHAR(1);
      DECLARE core_first VARCHAR(3);
      DECLARE core_sec VARCHAR(4);
      DECLARE core_third VARCHAR(2);
      DECLARE isbn_mock VARCHAR(12);
      DECLARE isbn VARCHAR(17);
      DECLARE i INT;
      
      SET prefix = '978';
      SET core = floor(rand() * 999999999) + 1;
      SET str_core = cast(core as char);
      SET str_core = LPAD(str_core, 9, '0');
      
      SET isbn_mock = CONCAT(prefix, str_core);
      
      SET sum = 0;
      SET i = 1;
      WHILE i <= 12 DO
		  IF mod(i,2) = 1 
			THEN SET sum = sum + CAST(SUBSTR(isbn_mock, i, 1) as signed);
          ELSE
			SET sum = sum + 3*CAST(SUBSTR(isbn_mock, i, 1) as signed);
		  END IF;
          SET i = i + 1;
      END WHILE;
      
      SET check_digit = 10 - mod(sum,10);
      
      IF check_digit = 10 THEN
          SET check_digit_str = 'X';
      ELSE
          SET check_digit_str = CAST(check_digit AS CHAR);
      END IF;
      
      SET isbn = CONCAT(prefix, '-', SUBSTR(isbn_mock, 4, 3), '-', 
						SUBSTR(isbn_mock, 7, 4), '-', SUBSTR(isbn_mock, 11, 2), '-', 
						check_digit_str);
      RETURN isbn;
  END//
  delimiter ;