create table book (
   book_id int not null auto_increment,
   title varchar(50) not null,
   publisher varchar(50) not null,
   ISBN varchar(17) not null unique, 
   book_cover varchar(2083) default null, 
   language varchar(20) not null, check (language regexp '^[a-zA-Z\s]+$'),
   average_rating decimal(2,1) default null,
   description text default null, check (length(description) <= 1000),
   pages int not null, check (pages > 0),
   publish_date date default null,
   numbers_copy int not null default 0,
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (book_id)
);

create INDEX book_title_idx ON book(title); 

create table author (
   author_id int not null auto_increment,
   name varchar(50) not null, check (name regexp '^[a-zA-Z\s.-]+'),
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (author_id)
);

create INDEX author_name_idx ON author(name); 
create table category (
   category_id int not null auto_increment,
   name varchar(50) not null unique, check (name regexp '^[a-zA-Z\s-]+'),
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (category_id)
);

create INDEX category_name_idx ON category(name); 

create table key_word (
   key_word_id int not null auto_increment,
   word varchar(50) not null unique, check (word regexp '^[a-zA-Z\s-]+'),
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (key_word_id)
);

create table book_category (
   book_id int not null,
   category_id int not null,
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (book_id, category_id),
   foreign key (book_id) references book (book_id) on update cascade on delete cascade ,
   foreign key (category_id) references category (category_id) on update cascade on delete cascade
);

create table book_author (
   book_id int not null,
   author_id int not null,
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (book_id, author_id),
   foreign key (book_id) references book (book_id) on update cascade on delete cascade,
   foreign key (author_id) references author (author_id) on update cascade on delete cascade
);

create table book_key_word (
   book_id int not null,
   key_word_id int not null,
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (book_id, key_word_id),
   foreign key (book_id) references book (book_id) on update cascade on delete cascade,
   foreign key (key_word_id) references key_word (key_word_id) on update cascade on delete cascade
);

create table contact (
   contact_id int not null auto_increment,
   address varchar(50) not null, 
   city varchar(50) not null, check (city regexp '^[a-zA-Z\s-]+$'),
   postal_code varchar(6) not null, check (postal_code regexp '^[1-9][0-9]{2} [0-9]{2}$'),
   email varchar(50) not null, check (email regexp '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'),
   telephone int default null,
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (contact_id)
); 

create table school (
   school_id int not null auto_increment,
   contact_id int null,
   name varchar(50) not null unique, 
   principal varchar(50) not null, check (principal regexp '^[a-zA-Z -]+$'),
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (school_id),
   foreign key (contact_id) references contact (contact_id) on update cascade on delete set null
); 

create table copy (
   copy_id int not null auto_increment,
   book_id int not null,
   school_id int not null,
   status enum('available', 'reserved', 'rented') not null default 'available', 
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (copy_id),
   foreign key (school_id) references school (school_id) on update cascade on delete cascade,
   foreign key (book_id) references book (book_id) on update cascade on delete cascade
);

create table user (
   user_id int not null auto_increment, 
   first_name varchar(50) not null, check (first_name regexp '^[a-zA-Z-]+$'),
   last_name varchar(50) not null, check (last_name regexp '^[a-zA-Z-]+$'),
   contact_id int not null,
   school_id int not null,
   birthdate date not null, 
   role enum('teacher', 'student') not null, 
   username varchar(50) not null unique,
   password varchar(50) not null,
   verification bool not null default 0,
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (user_id),
   foreign key (school_id) references school (school_id) on update cascade on delete cascade,
   foreign key (contact_id) references contact (contact_id) on update cascade on delete cascade
);
create INDEX user_username_idx ON user(username); 

create table rating (
   rating_id int not null auto_increment,
   user_id int not null,
   book_id int not null,
   rating_stars decimal(2,1) not null, check (rating_stars >= 0 and rating_stars <= 5),
   comment text default null, check (length(comment) <= 500), 
   verification bool not null, 
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (rating_id),
   foreign key (user_id) references user (user_id) on update cascade on delete cascade,
   foreign key (book_id) references book (book_id) on update cascade on delete cascade
);

create table moderator (
   mod_id int not null auto_increment,
   school_id int not null,
   contact_id int null,
   first_name varchar(50) not null, check (first_name regexp '^[a-zA-Z-]+$'),
   last_name varchar(50) not null, check (last_name regexp '^[a-zA-Z-]+$'),
   username varchar(50) not null unique,
   password varchar(50) not null,
   verification bool not null default 0, 
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (mod_id),
   foreign key (contact_id) references contact (contact_id) on update cascade on delete set null,
   foreign key (school_id) references school (school_id) on update cascade on delete cascade
);

create table admin (
   admin_id int not null auto_increment,
   contact_id int null,
   first_name varchar(50) not null, check (first_name regexp '^[a-zA-Z-]+$'),
   last_name varchar(50) not null, check (last_name regexp '^[a-zA-Z-]+$'),
   username varchar(50) not null unique,
   password varchar(50) not null,
   verification bool not null default 1,
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (admin_id),
   foreign key (contact_id) references contact (contact_id) on update cascade on delete set null
);

create table rental ( 
   rent_id int not null auto_increment,
   copy_id int default null,
   book_id int not null,
   mod_id int not null,
   user_id int not null,
   take_date date,  
   request_date datetime not null default current_timestamp,
   status enum('queued up', 'terminated', 'active', 'late', 'returned') default 'active',
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (rent_id),
   foreign key (copy_id) references copy (copy_id) on update cascade on delete cascade,
   foreign key (mod_id) references moderator (mod_id) on update cascade on delete cascade,
   foreign key (user_id) references user (user_id) on update cascade on delete cascade
);
CREATE INDEX rental_status_idx ON rental (status); 
CREATE INDEX rental_date_idx ON rental (take_date); 


create table reservation (
   rent_id int not null,
   reservation_date datetime not null default current_timestamp, 
   reserved_for date default null,
   book_id int not null,
   user_id int not null,
   mod_id int not null,
   status enum('on hold', 'active', 'terminated', 'completed') not null default 'on hold', 
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (rent_id),
   foreign key (rent_id) references rental (rent_id) on update cascade on delete cascade,
   foreign key (book_id) references book (book_id) on update cascade on delete cascade,
   foreign key (mod_id) references moderator (mod_id) on update cascade on delete cascade,
   foreign key (user_id) references user (user_id) on update cascade on delete cascade
);
CREATE INDEX res_status_idx ON reservation (status); 

create table returns ( 
   rent_id int not null,
   return_date datetime not null default current_timestamp,
   last_update timestamp not null default current_timestamp on update current_timestamp,
   primary key (rent_id),
   foreign key (rent_id) references rental (rent_id) on update cascade on delete cascade
);

create table request (
	request_id int not null auto_increment,
    book_id int not null,
	user_id int not null,
	status enum('pending', 'accepted', 'declined') not null default 'pending',
    primary key (request_id),
   foreign key (book_id) references book (book_id) on update cascade on delete cascade,
   foreign key (user_id) references user (user_id) on update cascade on delete cascade
);