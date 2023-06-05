const http = require('http');
const mysql = require('mysql2');
const fs = require('fs');
const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const { stringify } = require('querystring');




const hostname = '127.0.0.1';
const port = 3000;

// Serve static files from the "views" directory
app.use(express.static('views'));
app.use(cookieParser());
app.use(express.json());
// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// Define routes
app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});


// Create a MySQL connection
var connection = mysql.createConnection({
  host: 'booksdb.mysql.database.azure.com',
  user: 'GOAT1',
  password: 'QWqw1!ERer2@',
  database: 'booklibrary',
  port:3306,
  ssl:{
    ca:fs.readFileSync('C:/Users/Giannis Boufidis/Desktop/here/DigiCertGlobalRootCA.crt.pem')
  }
});

// Connect to the database
connection.connect(function(err) {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }

  console.log('Connected to the database successfully!');
});

// Start the server
app.listen(port, function(){
  console.log('Server running on http//localhost:${port}'); 
});


// Close the database connection when the server is closed
process.on('SIGINT', function() {
  connection.end(function(err) {
    if (err) {
      console.error('Error closing the database connection:', err);
      return;
    }

    console.log('Database connection closed.');
    process.exit();
  });
});


// Handle login request
app.post('/', (req, res) => {
  const { username, password } = req.body;

  // Perform database query to ckeck username and password
  const query = 'SELECT user_id, username, password, role, school_id FROM user WHERE username = ? AND password = ? AND verification = true';
connection.query(query, [username, password], (err, results) => {
  if (err) {
    console.error(err);
    res.status(500).json({error:'Internal server error'});
    return;
  }

  // Check if user is found in the user table
  if (results.length === 1){
    //create cookie
    const user = {
      user_id: results[0].user_id,
      username: results[0].username,
      school_id: results[0].school_id,
      capacity: results[0].role
    };
    const userCookie = JSON.stringify(user);

    //set the user with the user information
    res.cookie('user', userCookie, {maxAge: 864000000, httpOnly: true});

    res.json({role: 'user' });
   
  } else {
    // Query the database for username and password in the moderator table
    const moderatorQuery = 'SELECT mod_id, username, password, school_id FROM moderator WHERE username = ? AND password = ? AND verification = true';
   connection.query(moderatorQuery, [username, password], (modErr, modResults) => {
    if (modErr) {
      console.error(modErr);
      res.status(500).json({ error: 'Internal server error'});
      return;
    }

    //check if user is found in the moderator table
    if (modResults.length === 1) {

      const user = {
        user_id: modResults[0].mod_id,
        username: modResults[0].username,
        school_id: modResults[0].school_id,
        capacity: 'moderator'
      };

      const userCookie = JSON.stringify(user);

      //set the user with the user information
      res.cookie('user', userCookie, {maxAge: 864000000, httpOnly: true});

      res.json({ role: 'moderator'});
    } else {
      const adminQuery = 'SELECT username, password FROM admin WHERE username = ? AND password = ?';
      connection.query(adminQuery, [username, password], (adminErr, adminResults) => {
       if (adminErr) {
         console.error(adminErr);
         res.status(500).json({ error: 'Internal server error'});
         return;
       }
   
       //check if user is found in the admin table
       if (adminResults.length === 1) {
   
         const user = {
           username: adminResults[0].username,
           capacity: 'admin'
         };
   
         const userCookie = JSON.stringify(user);
   
         //set the user with the user information
         res.cookie('user', userCookie, {maxAge: 864000000, httpOnly: true});
   
         res.json({ role: 'admin'});
       } else {
         // Neither user nor moderator found with provided credentials
         res.status(401).json({ error: 'Invalid username or password'});
       }
      });
    }
   });
  }
});
});


// Sign up 

app.get('/schools', function (req, res) {
  //Query the database to fetch the schools
  connection.query('SELECT school_id, name FROM school', function(err, results){
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Internal server error'});
    }

    const schools = results.map((row) => ({ id:row.school_id, name: row.name }));

    res.json(schools);
  });
});
//////////////////////////////////////////////////////////////
//check if a username already exists
function checkUsernameAvailability(username, callback) {
  const query = 'SELECT COUNT(*) AS count FROM user WHERE username = ?';

  // execute the query with the provided username
  connection.query(query, [username], function (error, results) {
    if (error) {
      callback(error);
    } else {
      // extract the count from the query results
      const count = results[0].count;

      //check if the count is greater than 0, => the username exists
      const isAvailable = count === 0;

      callback(null, isAvailable);
    }
  }) ;
}
//////////////////////////////////////////////////////////////

app.post('/signup', function(req, res) {

  const { firstName, lastName, username, email, password, role, schoolId, birthDate, phone, address, postal_code, city } = req.body;
  

  checkUsernameAvailability(username, function(error, isAvailable) {
    if (error) {
      console.error("error checking username availability:", error);
      res.status(500).send("Internal server error");
    } else {
      if (isAvailable) {
         //insert the contact information into the contact table
  const contactQuery = 'INSERT INTO contact (email, address, postal_code, city, telephone) VALUES (?, ?, ?, ?, ?)';
  connection.query(contactQuery, [email, address, postal_code, city, phone], function(err, contactResult){
  if (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error'});
  }

  // get the generated contact ID
  const contact_id = contactResult.insertId;

  //insert the user information

  if (role === 'moderator') {
    const userQuery = 'INSERT INTO moderator (first_name, last_name, username, password, school_id, contact_id) VALUES (?, ?, ?, ?, ?, ?)';
      connection.query(userQuery, [firstName, lastName, username, password, schoolId, contact_id], function(err, userResult) {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Internal server error' });
        }

        //const user_id = userResult.insertId;
        // User registration successful
        res.json({ message: 'Mod registered successfully' });
      });
  }
  else {
    const userQuery = 'INSERT INTO user (first_name, last_name, username, password, school_id, contact_id, birthdate, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      connection.query(userQuery, [firstName, lastName, username, password, schoolId, contact_id, birthDate, role], function(err, userResult) {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Internal server error' });
        }

        //const user_id = userResult.insertId;
        // User registration successful
        res.json({ message: 'User registered successfully' });
      });
  }
  });
      }
      else {
       
       
      res.json({ message: 'Username already exists'});
      }
    }
  });
  
  
 
});


// logout 
app.get('/logout', (req,res) => {
  //clear the cookie 
  res.clearCookie('user');

  //redirect the user to the login page
  res.redirect('/');
});


//HOME PAGE 
app.get('/home', (req, res) => {
  // check if the cookie exists
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try{
    // parse the user info from the cookie 
    const user = JSON.parse(req.cookies.user); 
    
const  username = user.username;
const schoolId = user.school_id;
const role = user.capacity;

    //Query the database to fetch the school name using the school_id
    const schoolQuery = 'SELECT name FROM school WHERE school_id = ?';
    connection.query(schoolQuery, [schoolId], (err, results) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error'});
        return;
      } else {
        const schoolName = results[0].name;
       
       const responseData = {
        username: username, 
            schoolName: schoolName,
            role: role, 
       };
       
       res.sendFile(path.join(__dirname, 'views/homePage.html'));
       console.log(responseData);
       res.json(responseData);
      }
      
    });
  }   catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
  } else {
     res.status(401).json({ error: 'Unathorized'});
  }
});

// Fetch the filters for the books
app.get('/filter', (req, res) => {
  // check if the cookie exists
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try{
  // parse the user info from the cookie 
  const user = JSON.parse(req.cookies.user); 
  const schoolId = user.school_id;
  
  const categoriesQuery= 'SELECT name FROM category';
  const authorsQuery= 'SELECT name FROM author';
  



    connection.query(categoriesQuery, (err, categories) => {
      if(err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error'});
        return;
      }

      connection.query(authorsQuery, (err, authors) => {
        if(err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error'});
          return;
        }
        res.json({categories, authors});
        console.log({categories, authors});
      });
    });
 
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
    } else {
       res.status(401).json({ error: 'Unathorized'});
    }
});


app.get('/fetchBooks', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;
      const word = req.query.word; // Get the input word from the query parameter
      const author = req.query.author; // Get the selected author from the query parameter
      const categories = req.query.categories || []; // Get the selected categories from the query parameter (as an array)

      const bookIdQuery = 'SELECT distinct book_id FROM copy where school_id = ?';
      const bookDetailsQuery = 'SELECT * FROM book where book_id = ?';

      connection.query(bookIdQuery, [schoolId], (err, booksID) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        const bookIDs = booksID.map(book => book.book_id); // Extracting the book IDs

      let Allquery = `
      SELECT 
      DISTINCT b.book_id AS bookid,
      b.title AS title,
      b.publisher AS publisher,
      b.ISBN AS ISBN,
      b.book_cover AS book_cover,
      b.language,
      b.average_rating AS average_rating,
      b.description,
      b.pages AS pages,
      b.publish_date,
      b.numbers_copy AS numbers_copy,
      b.last_update,
      (SELECT GROUP_CONCAT(DISTINCT a.name SEPARATOR ', ')
   FROM author a
   INNER JOIN book_author ba ON a.author_id = ba.author_id
   WHERE ba.book_id = b.book_id) AS authorName,
      (SELECT GROUP_CONCAT(DISTINCT k.word SEPARATOR ', ')
   FROM key_word k
   INNER JOIN book_key_word bk ON bk.key_word_id = k.key_word_id
   WHERE bk.book_id = b.book_id) AS keyWord,
      (SELECT GROUP_CONCAT(DISTINCT c.name SEPARATOR ', ')
   FROM category c
   INNER JOIN book_category bc ON c.category_id = bc.category_id
   WHERE bc.book_id = b.book_id) AS categoryName
FROM
  book b
  INNER JOIN book_author ba ON b.book_id = ba.book_id
  INNER JOIN author a ON ba.author_id = a.author_id
  INNER JOIN book_category bc ON b.book_id = bc.book_id
  INNER JOIN category c ON bc.category_id = c.category_id
    WHERE b.book_id IN (?)
      `;
    
      const queryValues = [bookIDs]; // Array to store query values

      if (word) {
        Allquery += ' AND b.title LIKE ?'; // Add the additional filter for title
        queryValues.push(`%${word}%`); // Add the value for the title filter
      }
      if (author) {
        Allquery += ' AND a.name = ?'; // Add the additional filter for title
        queryValues.push(`${author}`); // Add the value for the title filter
      }
      if (categories.length > 0) {
        Allquery += 'AND c.name IN (?)';
        queryValues.push(categories);
      }

      Allquery += ' order BY b.book_id';

        // Fetch book details for each book separately
        const fetchBookDetails = (bookId) => {
          return new Promise((resolve, reject) => {
            connection.query(bookDetailsQuery, [bookId], (err, bookDetails) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                resolve(bookDetails[0]);
              }
            });
          });
        };

        connection.query(Allquery, queryValues, (err, results) => {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
          }

          const bookDetailsPromises = bookIDs.map(bookId => fetchBookDetails(bookId));
        
          Promise.all(bookDetailsPromises)
            .then(bookDetails => {
              const booksDetails = results.map(result => {
                const bookId = result.bookid;
                const bookDetail = bookDetails.find(detail => detail.book_id === bookId);
        
                let categoryName = result.categoryName;
                let authorName = result.authorName;
                let keyWord = result.keyWord;
  if (categoryName) {
    categoryName = categoryName.split(', ');
  } else {
    categoryName = [];
  }
  console.log(categoryName);

  if (authorName) {
    authorName = authorName.split(', ');
  } else {
    authorName = [];
  }
  console.log(authorName);

  if (keyWord) {
    keyWord = keyWord.split(', ');
  } else {
    keyWord = [];
  }
  console.log(keyWord);

                return {
                  book_id: bookId,
                  title: bookDetail.title,
                  publisher: bookDetail.publisher,
                  ISBN: bookDetail.ISBN,
                  book_cover: bookDetail.book_cover,
                  language: bookDetail.language,
                  average_rating: bookDetail.average_rating,
                  description: bookDetail.description,
                  pages: bookDetail.pages,
                  publish_date: bookDetail.publish_date,
                  numbers_copy: bookDetail.numbers_copy,
                  last_update: bookDetail.last_update,
                  authorName: authorName,
                  categoryName: categoryName,
                  keyWord: keyWord
                };
              });
        
              res.json({ booksDetails });
              console.log({ booksDetails });
            })
            .catch(error => {
              console.error(error);
              res.status(500).json({ error: 'Internal server error' });
            });
        });
        

      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/fetchRatings', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const bookId = req.query.bookId;

      const AvailableCopiesQuery = 'SELECT r.rating_id, r.rating_stars, r.comment, u.username FROM rating r INNER JOIN user u ON r.user_id=u.user_id where r.book_id = ? and r.verification = true';

      connection.query(AvailableCopiesQuery, [bookId], (err, results) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        // Extract the comment and rating_stars attributes into separate arrays
        const comments = results.map(result => result.comment);
        const ratings = results.map(result => result.rating_stars);
        const usernames = results.map(result => result.username);
        const rating_ids = results.map(result => result.rating_id);

        res.json({ comments, ratings, usernames, rating_ids });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/fetchAvailableCopies', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;
      const bookId = req.query.bookId;

      const AvailableCopiesQuery = 'SELECT count(*) as av_copies FROM copy where status in ("available") and school_id = ? and book_id = ?';

      connection.query(AvailableCopiesQuery, [schoolId, bookId], (err, results) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }

        const availableCopies = results[0].av_copies;
        res.json({ availableCopies });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/insertRental', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const userId = user.user_id;
      const bookId = req.body.bookId;

      const NewRentalQuery = 'insert into request (book_id, user_id) values (?, ?)';

      connection.query(NewRentalQuery, [bookId, userId], (err, RentalsResults) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }

        res.json({ message: 'Rental completed!!!!' });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/insertRating', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const userId = user.user_id;
      const bookId = req.body.bookId;
      const rating = req.body.rating;
      let comment = req.body.comment;

      // Check if the comment is empty and set it to null
      if (comment.trim() === '') {
        comment = null;
      }

      const NewRatingQuery = 'insert into rating (user_id, book_id, rating_stars, comment) values (?, ?, ?, ?)';

      connection.query(NewRatingQuery, [userId, bookId, rating, comment], (err, RatingsResults) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }

        res.json({ message: 'Rating completed!!!!' });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/myRes', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      const user = JSON.parse(req.cookies.user);
      const userId = user.user_id;

      let ResQuery = 'select r.rent_id, b.title, DATE_FORMAT(r.reserved_for, "%Y-%m-%d") AS reserved_for, r.status';
      ResQuery += ' from reservation r join book b on b.book_id = r.book_id';
      ResQuery += ' where r.user_id = ? and r.status in ("active", "on hold")';

      connection.query(ResQuery, [userId], (err, ressID) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        const ressData = ressID.map(res => ({
            rent_id: res.rent_id,
            title: res.title,
            reserved_for: res.reserved_for,
            status: res.status
        }));

        res.json({ ressData });
        console.log({ ressData });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/myRen', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      const user = JSON.parse(req.cookies.user);
      const userId = user.user_id;

      let RenQuery = 'select b.title, DATE_FORMAT(r.take_date, "%Y-%m-%d") AS take_date, r.status';
      RenQuery += ' from rental r join copy c on c.copy_id = r.copy_id';
      RenQuery += ' join book b on c.book_id = b.book_id';
      RenQuery += ' where r.user_id = ? and r.take_date is not null';

      connection.query(RenQuery, [userId], (err, rensID) => {
        if (err) {
            console.error(err);
            ren.status(500).json({ error: 'Internal server error' });
            return;
        }
        const rensData = rensID.map(ren => ({
            rent_id: ren.rent_id,
            title: ren.title,
            take_date: ren.take_date,
            status: ren.status
        }));

        res.json({ rensData });
        console.log({ rensData });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});




// POST route for creating a new book
app.post('/CreateNewBook', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;
      const bookData = req.body;

      // Step 1: Check if the book already exists in the `book` table
      const { title, publisher, ISBN, book_cover, language, description, pages, publish_date } = bookData;
      const checkBookQuery = `SELECT * FROM book WHERE title = ? AND publisher = ? AND ISBN = ? AND book_cover = ? AND language = ? AND description = ? AND pages = ? AND publish_date = ?`;
      connection.query(checkBookQuery, [title, publisher, ISBN, book_cover, language, description, pages, publish_date], (err, results) => {
      if (err) {
        console.error('Error checking book:', err);
        res.status(500).send('Error checking book');
      } else {
        // If the book doesn't exist, insert it into the `book` table
        if (results.length === 0) {
          const insertBookQuery = `INSERT INTO book (title, publisher, ISBN, book_cover, language, description, pages, publish_date) 
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
          connection.query(insertBookQuery,
                          [title, publisher, ISBN, book_cover, language, description, pages, publish_date],
                          (err, result) => {
                            if (err) {
                              console.error('Error inserting book:', err);
                              res.status(500).send('Error inserting book');
                            } else {
                              const bookId = result.insertId;
                              processAuthorsCategoriesKeywords(schoolId, bookId, bookData, res);
                            }
          });
        } else {
          // If the book already exists, you can handle it according to your requirements
          // For example, you can send a response indicating that the book already exists
          const bookId = results[0].book_id;
          insertCopies(schoolId, bookId, bookData, res);
        }
      }
    });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'EISAI MALAKAS?' });
  }
  
});

function processAuthorsCategoriesKeywords(schoolId, bookId, bookData, res) {
  const authors = bookData.authors.split(', ');
  const authorIds = [];

  let authorProcessed = 0;

  authors.forEach(author => {
    const checkAuthorQuery = `SELECT * FROM author WHERE name = ?`;
    connection.query(checkAuthorQuery, [author], (err, results) => {
      if (err) {
        console.error('Error checking author:', err);
        res.status(500).send('Error checking author');
        return;
      }

      if (results.length === 0) {
        const insertAuthorQuery = `INSERT INTO author (name) VALUES (?)`;
        connection.query(insertAuthorQuery, [author], (err, result) => {
          if (err) {
            console.error('Error inserting author:', err);
            res.status(500).send('Error inserting author');
            return;
          }

          authorIds.push(result.insertId);
          authorProcessed++;

          if (authorProcessed === authors.length) {
            processCategories(schoolId, bookId, bookData, authorIds, res);
          }
        });
      } else {
        authorIds.push(results[0].author_id);
        authorProcessed++;

        if (authorProcessed === authors.length) {
          processCategories(schoolId, bookId, bookData, authorIds, res);
        }
      }
    });
  });
}

// Function to process categories
function processCategories(schoolId, bookId, bookData, authorIds, res) {
  const categories = bookData.category.split(', ');
  const categoryIds = [];

  // Iterate through categories and insert new ones if they don't exist
  categories.forEach(category => {
    const checkCategoryQuery = `SELECT * FROM category WHERE name = ?`;
    connection.query(checkCategoryQuery, [category], (err, results) => {
      if (err) {
        console.error('Error checking category:', err);
        res.status(500).send('Error checking category');
      } else {
        if (results.length === 0) {
          const insertCategoryQuery = `INSERT INTO category (name) VALUES (?)`;
          connection.query(insertCategoryQuery, [category], (err, result) => {
            if (err) {
              console.error('Error inserting category:', err);
              res.status(500).send('Error inserting category');
            } else {
              categoryIds.push(result.insertId);
              if (categoryIds.length === categories.length) {
                // All categories processed, move to the next step
                processKeywords(schoolId, bookId, bookData, authorIds, categoryIds, res);
              }
            }
          });
        } else {
          categoryIds.push(results[0].category_id);
          if (categoryIds.length === categories.length) {
            // All categories processed, move to the next step
            processKeywords(schoolId, bookId, bookData, authorIds, categoryIds, res);
          }
        }
      }
    });
  });
}

// Function to process keywords
function processKeywords(schoolId, bookId, bookData, authorIds, categoryIds, res) {
  const keywords = bookData.key_words.split(', ');
  const keywordIds = [];

  // Iterate through keywords and insert new ones if they don't exist
  keywords.forEach(keyword => {
    const checkKeywordQuery = `SELECT * FROM key_word WHERE word = ?`;
    connection.query(checkKeywordQuery, [keyword], (err, results) => {
      if (err) {
        console.error('Error checking keyword:', err);
        res.status(500).send('Error checking keyword');
      } else {
        if (results.length === 0) {
          const insertKeywordQuery = `INSERT INTO key_word (word) VALUES (?)`;
          connection.query(insertKeywordQuery, [keyword], (err, result) => {
            if (err) {
              console.error('Error inserting keyword:', err);
              res.status(500).send('Error inserting keyword');
            } else {
              keywordIds.push(result.insertId);
              if (keywordIds.length === keywords.length) {
                // All keywords processed, move to the final step
                insertBookRelations(schoolId, bookId, authorIds, categoryIds, keywordIds, bookData, res);
              }
            }
          });
        } else {
          keywordIds.push(results[0].key_word_id);
          if (keywordIds.length === keywords.length) {
            // All keywords processed, move to the final step
            insertBookRelations(schoolId, bookId, authorIds, categoryIds, keywordIds, bookData, res);
          }
        }
      }
    });
  });
}

function insertBookRelations(schoolId, bookId, authorIds, categoryIds, keywordIds, bookData, res) {
  const insertBookAuthorQuery = `INSERT INTO book_author (book_id, author_id) VALUES (?, ?)`;
  const insertBookCategoryQuery = `INSERT INTO book_category (book_id, category_id) VALUES (?, ?)`;
  const insertBookKeywordQuery = `INSERT INTO book_key_word (book_id, key_word_id) VALUES (?, ?)`;

  let relationsProcessed = 0;

  authorIds.forEach(authorId => {
    connection.query(insertBookAuthorQuery, [bookId, authorId], (err, result) => {
      if (err) {
        console.error('Error inserting book-author relation:', err);
        res.status(500).send('Error inserting book-author relation');
        return;
      }

      relationsProcessed++;

      if (relationsProcessed === authorIds.length + categoryIds.length + keywordIds.length) {
        insertCopies(schoolId, bookId, bookData, res);
      }
    });
  });

  categoryIds.forEach(categoryId => {
    connection.query(insertBookCategoryQuery, [bookId, categoryId], (err, result) => {
      if (err) {
        console.error('Error inserting book-author relation:', err);
        res.status(500).send('Error inserting book-author relation');
        return;
      }

      relationsProcessed++;

      if (relationsProcessed === authorIds.length + categoryIds.length + keywordIds.length) {
        insertCopies(schoolId, bookId, bookData, res);
      }
    });
  });

  keywordIds.forEach(keywordId => {
    connection.query(insertBookKeywordQuery, [bookId, keywordId], (err, result) => {
      if (err) {
        console.error('Error inserting book-author relation:', err);
        res.status(500).send('Error inserting book-author relation');
        return;
      }

      relationsProcessed++;

      if (relationsProcessed === authorIds.length + categoryIds.length + keywordIds.length) {
        insertCopies(schoolId, bookId, bookData, res);
      }
    });
  });
  // Similar modifications need to be done for insertBookCategoryQuery and insertBookKeywordQuery

  // Move the insertCopyQuery logic to a separate function insertCopies and handle the response there
}

function insertCopies(schoolId, bookId, bookData, res) {
  const copies = parseInt(bookData.copies);
  const insertCopyQuery = `INSERT INTO copy (school_id, book_id) VALUES (?, ?)`;

  let copiesProcessed = 0;

  for (let i = 0; i < copies; i++) {
    connection.query(insertCopyQuery, [schoolId, bookId], (err, result) => {
      if (err) {
        console.error('Error inserting copy:', err);
        res.status(500).send('Error inserting copy');
        return;
      }

      copiesProcessed++;

      if (copiesProcessed === copies) {
        res.send('Book insertion completed successfully');
      }
    });
  }
}

app.get('/fetchModBooks', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;
      const word = req.query.word; // Get the input word from the query parameter
      const author = req.query.author; // Get the selected author from the query parameter
      const categories = req.query.categories; // Get the selected categories from the query parameter (as an array)
      const copies = req.query.copies;
      const copies_int = parseInt(copies);

      const bookIdQuery = 'SELECT distinct book_id FROM copy where school_id = ?';
      const bookDetailsQuery = 'SELECT * FROM book where book_id = ?';

      connection.query(bookIdQuery, [schoolId], (err, booksID) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        const bookIDs = booksID.map(book => book.book_id); // Extracting the book IDs

      let Allquery = `
      SELECT 
      DISTINCT b.book_id AS bookid,
      b.title AS title,
      (SELECT count(*) FROM copy c WHERE c.book_id = b.book_id and c.school_id = ?) AS totalCopies,
      (SELECT count(*) FROM copy c WHERE c.book_id = b.book_id and c.school_id = ? and c.status = 'available') AS availableCopies,
      (SELECT GROUP_CONCAT(DISTINCT u.username SEPARATOR ', ')
   FROM user u
   INNER JOIN rental r ON r.user_id = u.user_id
   WHERE r.book_id = b.book_id and r.status in ('active', 'late') and u.school_id = ?) AS activeRentals,
      (SELECT GROUP_CONCAT(DISTINCT u.username SEPARATOR ', ')
   FROM user u
   INNER JOIN reservation res ON res.user_id = u.user_id
   WHERE res.book_id = b.book_id and res.status = 'active' and u.school_id = ?) AS activeReservations,
      (SELECT GROUP_CONCAT(DISTINCT a.name SEPARATOR ', ')
   FROM author a
   INNER JOIN book_author ba ON a.author_id = ba.author_id
   WHERE ba.book_id = b.book_id) AS authorName,
      (SELECT GROUP_CONCAT(DISTINCT c.name SEPARATOR ', ')
   FROM category c
   INNER JOIN book_category bc ON c.category_id = bc.category_id
   WHERE bc.book_id = b.book_id) AS categoryName
FROM
  book b
  INNER JOIN book_author ba ON b.book_id = ba.book_id
  INNER JOIN author a ON a.author_id = ba.author_id
  INNER JOIN book_category bc ON b.book_id = bc.book_id
  INNER JOIN category cat ON cat.category_id = bc.category_id
    WHERE b.book_id IN (?)
      `;
    
      const queryValues = [ schoolId, schoolId, schoolId, schoolId, bookIDs]; // Array to store query values

      if (word) {
        Allquery += ' AND b.title LIKE ?'; // Add the additional filter for title
        queryValues.push(`%${word}%`); // Add the value for the title filter
      }
      if (author) {
        Allquery += ' AND a.name LIKE ?'; // Add the additional filter for title
        queryValues.push(`%${author}%`); // Add the value for the title filter
      }
      if (categories) {
        Allquery += 'AND cat.name LIKE ?';
        queryValues.push(`%${categories}%`);
      }
      if (copies) {
        Allquery += 'AND (SELECT COUNT(*) FROM copy c WHERE c.school_id = ? AND c.book_id = b.book_id) > ?';
        queryValues.push(`${schoolId}`);
        queryValues.push(`${copies_int}`);
      }

      Allquery += ' order BY b.book_id';

        // Fetch book details for each book separately
        const fetchBookDetails = (bookId) => {
          return new Promise((resolve, reject) => {
            connection.query(bookDetailsQuery, [bookId], (err, bookDetails) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                resolve(bookDetails[0]);
              }
            });
          });
        };

        connection.query(Allquery, queryValues, (err, results) => {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
          }

          const bookDetailsPromises = bookIDs.map(bookId => fetchBookDetails(bookId));
        
          Promise.all(bookDetailsPromises)
            .then(bookDetails => {
              const booksDetails = results.map(result => {
                const bookId = result.bookid;
                const bookDetail = bookDetails.find(detail => detail.book_id === bookId);
        
                const totalCopies = result.totalCopies;
                const availableCopies = result.availableCopies;
                let categoryName = result.categoryName;
                let authorName = result.authorName;
                let activeRentals = result.activeRentals;
                let activeReservations = result.activeReservations;
  if (categoryName) {
    categoryName = categoryName.split(', ');
  } else {
    categoryName = [];
  }
  console.log(categoryName);

  if (authorName) {
    authorName = authorName.split(', ');
  } else {
    authorName = [];
  }
  console.log(authorName);

  if (activeRentals) {
    activeRentals = activeRentals.split(', ');
  } else {
    activeRentals = [];
  }
  console.log(activeRentals);

  if (activeReservations) {
    activeReservations = activeReservations.split(', ');
  } else {
    activeReservations = [];
  }
  console.log(activeReservations);

                return {
                  book_id: bookId,
                  title: bookDetail.title,
                  totalCopies: totalCopies,
                  availableCopies: availableCopies,
                  authorName: authorName,
                  categoryName: categoryName,
                  activeRentals: activeRentals,
                  activeReservations: activeReservations
                };
              });
        
              res.json({ booksDetails });
              console.log({ booksDetails });
            })
            .catch(error => {
              console.error(error);
              res.status(500).json({ error: 'Internal server error' });
            });
        });
        

      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/fetchModUsers', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;
      const name = req.query.name; // Get the input name from the query parameter

      const userIdQuery = 'SELECT user_id FROM user where school_id = ? and verification = true';
      const userDetailsQuery = 'SELECT * FROM user where user_id = ?';

      connection.query(userIdQuery, [schoolId], (err, usersID) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        const userIDs = usersID.map(user => user.user_id); // Extracting the book IDs

      let Allquery = `
      SELECT 
      u.user_id as user_id,
      u.first_name as first_name,
      u.last_name as last_name,
      u.role as role,
      DATE_FORMAT(u.birthdate, '%Y-%m-%d') as birthdate,
      c.email as email,
      c.telephone as telephone,
      c.address as address,
      (SELECT avg(r.rating_stars) FROM rating r WHERE r.user_id = u.user_id) AS average_rating,
      (SELECT count(*) FROM rental ren WHERE ren.user_id = u.user_id and ren.status in ('active', 'late')) AS active_rents
      FROM user u
        INNER JOIN contact c ON c.contact_id = u.contact_id
      WHERE u.user_id IN (?)`;
    
      const queryValues = [ userIDs ]; // Array to store query values

      if (name) {
        Allquery += ' AND u.last_name LIKE ?'; // Add the additional filter for name
        queryValues.push(`%${name}%`); // Add the value for the name filter
      }

      Allquery += ' order BY u.user_id';

        // Fetch book details for each book separately
        const fetchUserDetails = (userId) => {
          return new Promise((resolve, reject) => {
            connection.query(userDetailsQuery, [userId], (err, userDetails) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                resolve(userDetails[0]);
              }
            });
          });
        };

        connection.query(Allquery, queryValues, (err, results) => {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
          }

          const userDetailsPromises = userIDs.map(userId => fetchUserDetails(userId));
        
          Promise.all(userDetailsPromises)
            .then(userDetails => {
              const usersDetails = results.map(result => {
                const userId = result.user_id;
                const userDetail = userDetails.find(detail => detail.user_id === userId);
                
                const email = result.email;
                const telephone = result.telephone;
                const address = result.address;
                const birthdate = result.birthdate;
                const active_rents = result.active_rents;
                const average_rating = result.average_rating;

                return {
                  user_id: userId,
                  first_name: userDetail.first_name,
                  last_name: userDetail.last_name,
                  email: email,
                  role: userDetail.role,
                  birthdate: birthdate,
                  telephone: telephone,
                  address: address,
                  active_rents: active_rents,
                  average_rating: average_rating,
                };
              });
        
              res.json({ usersDetails });
              console.log({ usersDetails });
            })
            .catch(error => {
              console.error(error);
              res.status(500).json({ error: 'Internal server error' });
            });
        });
        

      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/fetchModUsersUnver', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;

      const userIdQuery = 'SELECT user_id FROM user where school_id = ? and verification = false';
      const userDetailsQuery = 'SELECT * FROM user where user_id = ?';

      connection.query(userIdQuery, [schoolId], (err, usersID) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        const userIDs = usersID.map(user => user.user_id); // Extracting the book IDs

      let Allquery = `
      SELECT 
      u.user_id as user_id,
      u.first_name as first_name,
      u.last_name as last_name,
      u.role as role,
      DATE_FORMAT(u.birthdate, '%Y-%m-%d') as birthdate,
      c.email as email,
      c.telephone as telephone,
      c.address as address,
      s.name as school
      FROM user u
        INNER JOIN contact c ON c.contact_id = u.contact_id
        INNER JOIN school s ON s.school_id = u.school_id
      WHERE u.user_id IN (?)`;
    
      const queryValues = [ userIDs ]; // Array to store query values

      Allquery += ' order BY u.user_id';

        // Fetch book details for each book separately
        const fetchUserDetails = (userId) => {
          return new Promise((resolve, reject) => {
            connection.query(userDetailsQuery, [userId], (err, userDetails) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                resolve(userDetails[0]);
              }
            });
          });
        };

        connection.query(Allquery, queryValues, (err, results) => {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
          }

          const userDetailsPromises = userIDs.map(userId => fetchUserDetails(userId));
        
          Promise.all(userDetailsPromises)
            .then(userDetails => {
              const usersDetails = results.map(result => {
                const userId = result.user_id;
                const userDetail = userDetails.find(detail => detail.user_id === userId);
                
                const email = result.email;
                const telephone = result.telephone;
                const address = result.address;
                const school = result.school;
                const birthdate = result.birthdate;

                return {
                  user_id: userId,
                  first_name: userDetail.first_name,
                  last_name: userDetail.last_name,
                  email: email,
                  role: userDetail.role,
                  birthdate: birthdate,
                  telephone: telephone,
                  address: address,
                  school: school
                };
              });
        
              res.json({ usersDetails });
              console.log({ usersDetails });
            })
            .catch(error => {
              console.error(error);
              res.status(500).json({ error: 'Internal server error' });
            });
        });
        

      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/cancelUsers', (req, res) => {
  const user_id = req.body.user_id;

  const cancelQuery = 'update user set verification = false where user_id = ?';

  connection.query(cancelQuery, [ user_id ], (err, CancelsResults) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.json({ message: 'Rental completed!!!!' });
  });
})

app.post('/verUsers', (req, res) => {
  const user_id = req.body.user_id;

  const cancelQuery = 'update user set verification = true where user_id = ?';

  connection.query(cancelQuery, [ user_id ], (err, CancelsResults) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.json({ message: 'Rental completed!!!!' });
  });
})

app.get('/fetchRenReq', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;
      const name = req.query.name; // Get the input name from the query parameter
      const title = req.query.title; // Get the input title from the query parameter

      const reqIdQuery = 'SELECT request_id FROM request req inner join user u on req.user_id=u.user_id where u.school_id = ? and u.verification = true and req.status="pending"';
      const reqDetailsQuery = 'SELECT * FROM request where request_id = ?';

      connection.query(reqIdQuery, [schoolId], (err, reqsID) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        const reqIDs = reqsID.map(req => req.request_id); // Extracting the book IDs

      let Allquery = `
      SELECT 
      req.request_id as request_id,
      req.user_id as user_id,
      req.book_id as book_id,
      u.first_name as first_name,
      u.last_name as last_name,
      u.role as role,
      b.title as title,
      (SELECT count(*) FROM copy c WHERE c.book_id = b.book_id and c.school_id = ? and c.status='available') AS av_copies
      FROM request req
        INNER JOIN user u ON u.user_id = req.user_id
        INNER JOIN book b ON b.book_id = req.book_id
      WHERE req.request_id IN (?)
      `;
    
      const queryValues = [ schoolId, reqIDs ]; // Array to store query values

      if (name) {
        Allquery += ' AND u.last_name LIKE ?'; // Add the additional filter for name
        queryValues.push(`%${name}%`); // Add the value for the name filter
      }
      if (title) {
        Allquery += ' AND b.title LIKE ?'; // Add the additional filter for τιτλ
        queryValues.push(`%${title}%`); // Add the value for the name filter
      }

      Allquery += ' group by req.request_id order BY req.request_id';

        // Fetch book details for each book separately
        const fetchReqDetails = (reqId) => {
          return new Promise((resolve, reject) => {
            connection.query(reqDetailsQuery, [reqId], (err, reqDetails) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                resolve(reqDetails[0]);
              }
            });
          });
        };

        connection.query(Allquery, queryValues, (err, results) => {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
          }

          const reqDetailsPromises = reqIDs.map(reqId => fetchReqDetails(reqId));
        
          Promise.all(reqDetailsPromises)
            .then(reqDetails => {
              const reqsDetails = results.map(result => {
                const reqId = result.request_id;
                const reqDetail = reqDetails.find(detail => detail.request_id === reqId);
                
                const user_id = result.user_id;
                const book_id = result.book_id;
                const first_name = result.first_name;
                const last_name = result.last_name;
                const role = result.role;
                const title = result.title;
                const av_copies = result.av_copies;

                return {
                  request_id: reqDetail.request_id,
                  user_id: user_id,
                  book_id: book_id,
                  first_name: first_name,
                  last_name: last_name,
                  role: role,
                  title: title,
                  av_copies: av_copies
                };
              });
        
              res.json({ reqsDetails });
              console.log({ reqsDetails });
            })
            .catch(error => {
              console.error(error);
              res.status(500).json({ error: 'Internal server error' });
            });
        });
        

      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/decRen', (req, res) => {
  const request_id = req.body.request_id;

  const declineQuery = 'update request set status="declined" where request_id = ?';

  connection.query(declineQuery, [ request_id ], (err, declineResults) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.json({ message: 'Rental declined!!!!' });
  });
})

app.post('/accRen', (req, res) => {
  const request_id = req.body.request_id;

  const acceptQuery = 'update request set status="accepted" where request_id = ?';

  connection.query(acceptQuery, [ request_id ], (err, acceptResults) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.json({ message: 'Rental accepted!!!!' });
  });
})

app.get('/fetchResReq', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;
      const name = req.query.name; // Get the input name from the query parameter

      const reserIdQuery = 'SELECT reser.rent_id FROM reservation reser inner join user u on reser.user_id=u.user_id where u.school_id = ? and u.verification = true and reser.status="active"';
      const reserDetailsQuery = 'SELECT * FROM reservation where rent_id = ?';

      connection.query(reserIdQuery, [schoolId], (err, resersID) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        const reserIDs = resersID.map(reser => reser.rent_id); // Extracting the book IDs

      let Allquery = `
      SELECT 
      reser.rent_id as rent_id,
      reser.user_id as user_id,
      reser.book_id as book_id,
      u.first_name as first_name,
      u.last_name as last_name,
      u.role as role,
      b.title as title,
      DATE_FORMAT(reser.reserved_for, '%Y-%m-%d') as activation_date
      FROM reservation reser
        INNER JOIN user u ON u.user_id = reser.user_id
        INNER JOIN book b ON b.book_id = reser.book_id
      WHERE reser.rent_id IN (?)`;
    
      const queryValues = [ reserIDs ]; // Array to store query values

      if (name) {
        Allquery += ' AND u.last_name LIKE ?'; // Add the additional filter for name
        queryValues.push(`%${name}%`); // Add the value for the name filter
      }

      Allquery += ' order BY reser.reserved_for';

        // Fetch book details for each book separately
        const fetchReserDetails = (reserId) => {
          return new Promise((resolve, reject) => {
            connection.query(reserDetailsQuery, [reserId], (err, reserDetails) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                resolve(reserDetails[0]);
              }
            });
          });
        };

        connection.query(Allquery, queryValues, (err, results) => {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
          }

          const reserDetailsPromises = reserIDs.map(reserId => fetchReserDetails(reserId));
        
          Promise.all(reserDetailsPromises)
            .then(reserDetails => {
              const resersDetails = results.map(result => {
                const reserId = result.rent_id;
                const reserDetail = reserDetails.find(detail => detail.rent_id === reserId);
                
                const user_id = result.user_id;
                const book_id = result.book_id;
                const first_name = result.first_name;
                const last_name = result.last_name;
                const role = result.role;
                const title = result.title;
                const activation_date = result.activation_date;

                return {
                  rent_id: reserDetail.rent_id,
                  user_id: user_id,
                  book_id: book_id,
                  first_name: first_name,
                  last_name: last_name,
                  role: role,
                  title: title,
                  activation_date: activation_date
                };
              });
        
              res.json({ resersDetails });
              console.log({ resersDetails });
            })
            .catch(error => {
              console.error(error);
              res.status(500).json({ error: 'Internal server error' });
            });
        });
        

      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/decRes', (req, res) => {
  const rent_id = req.body.rent_id;

  const declineQuery = 'update rental set status="terminated" where rent_id = ?';

  connection.query(declineQuery, [ rent_id ], (err, declineResults) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.json({ message: 'Rental declined!!!!' });
  });
})

app.post('/compRes', (req, res) => {
  const rent_id = req.body.rent_id;

  const acceptQuery = 'update reservation set status="completed" where rent_id = ?';

  connection.query(acceptQuery, [ rent_id ], (err, acceptResults) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.json({ message: 'Rental accepted!!!!' });
  });
})

app.get('/fetchUnverRate', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;
      const name = req.query.name; // Get the input name from the query parameter

      const ratIdQuery = 'SELECT r.rating_id FROM rating r inner join user u on r.user_id=u.user_id where u.school_id = ? and u.verification = true and r.verification=false';
      const ratDetailsQuery = 'SELECT * FROM rating where rating_id = ?';

      connection.query(ratIdQuery, [schoolId], (err, ratsID) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        const ratIDs = ratsID.map(rat => rat.rating_id); // Extracting the book IDs

      let Allquery = `
      SELECT 
      r.rating_id as rating_id,
      r.user_id as user_id,
      r.book_id as book_id,
      u.first_name as first_name,
      u.last_name as last_name,
      b.title as title,
      r.rating_stars as rating,
      r.comment as comment
      FROM rating r
        INNER JOIN user u ON u.user_id = r.user_id
        INNER JOIN book b ON b.book_id = r.book_id
      WHERE r.rating_id IN (?)`;
    
      const queryValues = [ ratIDs ]; // Array to store query values

      if (name) {
        Allquery += ' AND u.last_name LIKE ?'; // Add the additional filter for name
        queryValues.push(`%${name}%`); // Add the value for the name filter
      }

      Allquery += ' order BY r.rating_id';

        // Fetch book details for each book separately
        const fetchRatDetails = (ratId) => {
          return new Promise((resolve, reject) => {
            connection.query(ratDetailsQuery, [ratId], (err, ratDetails) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                resolve(ratDetails[0]);
              }
            });
          });
        };

        connection.query(Allquery, queryValues, (err, results) => {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
          }

          const ratDetailsPromises = ratIDs.map(ratId => fetchRatDetails(ratId));
        
          Promise.all(ratDetailsPromises)
            .then(ratDetails => {
              const ratsDetails = results.map(result => {
                const ratId = result.rating_id;
                const ratDetail = ratDetails.find(detail => detail.rating_id === ratId);
                
                const user_id = result.user_id;
                const book_id = result.book_id;
                const first_name = result.first_name;
                const last_name = result.last_name;
                const title = result.title;
                const rating = result.rating;
                const comment = result.comment;

                return {
                  rating_id: ratDetail.rating_id,
                  user_id: user_id,
                  book_id: book_id,
                  first_name: first_name,
                  last_name: last_name,
                  title: title,
                  rating: rating,
                  comment: comment
                };
              });
        
              res.json({ ratsDetails });
              console.log({ ratsDetails });
            })
            .catch(error => {
              console.error(error);
              res.status(500).json({ error: 'Internal server error' });
            });
        });
        

      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/accRat', (req, res) => {
  const rating_id = req.body.rating_id;

  const acceptQuery = 'update rating set verification=true where rating_id = ?';

  connection.query(acceptQuery, [ rating_id ], (err, acceptResults) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.json({ message: 'Rental declined!!!!' });
  });
})

app.get('/fetchCategRate', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;

      let CatRatQuery = 'select avg(r.rating_stars) as average_rating, c.name as category';
      CatRatQuery += ' from rating r join book b on b.book_id = r.book_id';
      CatRatQuery += ' join book_category bc on bc.book_id = b.book_id';
      CatRatQuery += ' join category c on bc.category_id = c.category_id';
      CatRatQuery += ' join user u on r.user_id = u.user_id';
      CatRatQuery += ' where u.school_id = ?';
      CatRatQuery += ' group by c.category_id ';
      CatRatQuery += ' order by average_rating desc';

      connection.query(CatRatQuery, [schoolId], (err, CatRatsID) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }

        const CatRatsData = CatRatsID.map(CatRat => ({
          category: CatRat.category,
          average_rating: CatRat.average_rating
        }));

        res.json({ CatRatsData });
        console.log({ CatRatsData });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});


// POST route for editing a book
app.post('/UpdateBook', (req, res) => {
      const UpdatedBookData = req.body;

      // Step 1: Check if the book already exists in the `book` table
      const { book_id, title, publisher, ISBN, authors, pages, description, book_cover, publish_date, categories, language, keywords } = UpdatedBookData;
      const checkBookQuery = `SELECT * FROM book WHERE book_id = ?`;
      connection.query(checkBookQuery, [ book_id ], (err, results) => {
        if (err) {
          console.error('Error checking book:', err);
          res.status(500).send('Error checking book');
        } else {
          // If the book doesn't exist, handle the update operation
          if (results.length === 0) {
            // Handle the case when the book with the specified bookId doesn't exist
            res.status(404).send('Book not found');
          } else {
            // Step 2: Update the book data in the `book` table
            const updateBookQuery = `UPDATE book 
                                     SET title = ?, publisher = ?, ISBN = ?, book_cover = ?, language = ?, description = ?, pages = ?, publish_date = ?
                                     WHERE book_id = ?`;
            connection.query(updateBookQuery, [title, publisher, ISBN, book_cover, language, description, pages, publish_date, book_id], (err, result) => {
              if (err) {
                console.error('Error updating book:', err);
                res.status(500).send('Error updating book');
              } else {
                // Handle the update of authors, categories, and keywords (if required)
                updateAuthorsCategoriesKeywords(book_id, UpdatedBookData, res);
              }
            });
          }
        }
      });
});

function updateAuthorsCategoriesKeywords(bookId, bookData, res) {
  const removeAuthorsQuery = `DELETE FROM book_author WHERE book_id = ?`
  const removeCategoriesQuery = `DELETE FROM book_category WHERE book_id = ?`
  const removeKeywordsQuery = `DELETE FROM book_key_word WHERE book_id = ?`
  
  connection.query(removeAuthorsQuery, [bookId], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    
    connection.query(removeCategoriesQuery, [bookId], (err, results) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      connection.query(removeKeywordsQuery, [bookId], (err, results) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        
        const authors = bookData.authors.split(', ');
        const authorIds = [];
      
        let authorProcessed = 0;
      
        authors.forEach(author => {
          const checkAuthorQuery = `SELECT * FROM author WHERE name = ?`;
          connection.query(checkAuthorQuery, [author], (err, results) => {
            if (err) {
              console.error('Error checking author:', err);
              res.status(500).send('Error checking author');
              return;
            }
      
            if (results.length === 0) {
              const insertAuthorQuery = `INSERT INTO author (name) VALUES (?)`;
              connection.query(insertAuthorQuery, [author], (err, result) => {
                if (err) {
                  console.error('Error inserting author:', err);
                  res.status(500).send('Error inserting author');
                  return;
                }
      
                authorIds.push(result.insertId);
                authorProcessed++;
      
                if (authorProcessed === authors.length) {
                  updateCategories(bookId, bookData, authorIds, res);
                }
              });
            } else {
              authorIds.push(results[0].author_id);
              authorProcessed++;
      
              if (authorProcessed === authors.length) {
                updateCategories(bookId, bookData, authorIds, res);
              }
            }
          });
        });
        
      });
    });
  });
}

function updateCategories(bookId, bookData, authorIds, res) {
  const categories = bookData.categories.split(', ');
  const categoryIds = [];

  // Iterate through categories and insert new ones if they don't exist
  categories.forEach(category => {
    const checkCategoryQuery = `SELECT * FROM category WHERE name = ?`;
    connection.query(checkCategoryQuery, [category], (err, results) => {
      if (err) {
        console.error('Error checking category:', err);
        res.status(500).send('Error checking category');
      } else {
        if (results.length === 0) {
          const insertCategoryQuery = `INSERT INTO category (name) VALUES (?)`;
          connection.query(insertCategoryQuery, [category], (err, result) => {
            if (err) {
              console.error('Error inserting category:', err);
              res.status(500).send('Error inserting category');
            } else {
              categoryIds.push(result.insertId);
              if (categoryIds.length === categories.length) {
                // All categories processed, move to the next step
                updateKeywords(bookId, bookData, authorIds, categoryIds, res);
              }
            }
          });
        } else {
          categoryIds.push(results[0].category_id);
          if (categoryIds.length === categories.length) {
            // All categories processed, move to the next step
            updateKeywords(bookId, bookData, authorIds, categoryIds, res);
          }
        }
      }
    });
  });
}

function updateKeywords(bookId, bookData, authorIds, categoryIds, res) {
  const keywords = bookData.keywords.split(', ');
  const keywordIds = [];

  // Iterate through keywords and insert new ones if they don't exist
  keywords.forEach(keyword => {
    const checkKeywordQuery = `SELECT * FROM key_word WHERE word = ?`;
    connection.query(checkKeywordQuery, [keyword], (err, results) => {
      if (err) {
        console.error('Error checking keyword:', err);
        res.status(500).send('Error checking keyword');
      } else {
        if (results.length === 0) {
          const insertKeywordQuery = `INSERT INTO key_word (word) VALUES (?)`;
          connection.query(insertKeywordQuery, [keyword], (err, result) => {
            if (err) {
              console.error('Error inserting keyword:', err);
              res.status(500).send('Error inserting keyword');
            } else {
              keywordIds.push(result.insertId);
              if (keywordIds.length === keywords.length) {
                // All keywords processed, move to the final step
                updateBookRelations(bookId, authorIds, categoryIds, keywordIds, bookData, res);
              }
            }
          });
        } else {
          keywordIds.push(results[0].key_word_id);
          if (keywordIds.length === keywords.length) {
            // All keywords processed, move to the final step
            updateBookRelations(bookId, authorIds, categoryIds, keywordIds, bookData, res);
          }
        }
      }
    });
  });
}

function updateBookRelations(bookId, authorIds, categoryIds, keywordIds, bookData, res) {
  const insertBookAuthorQuery = `INSERT INTO book_author (book_id, author_id) VALUES (?, ?)`;
  const insertBookCategoryQuery = `INSERT INTO book_category (book_id, category_id) VALUES (?, ?)`;
  const insertBookKeywordQuery = `INSERT INTO book_key_word (book_id, key_word_id) VALUES (?, ?)`;

  let relationsProcessed = 0;

  authorIds.forEach(authorId => {
    connection.query(insertBookAuthorQuery, [bookId, authorId], (err, result) => {
      if (err) {
        console.error('Error inserting book-author relation:', err);
        res.status(500).send('Error inserting book-author relation');
        return;
      }

      relationsProcessed++;

      if (relationsProcessed === authorIds.length + categoryIds.length + keywordIds.length) {
        res.send('Book insertion completed successfully');
      }
    });
  });

  categoryIds.forEach(categoryId => {
    connection.query(insertBookCategoryQuery, [bookId, categoryId], (err, result) => {
      if (err) {
        console.error('Error inserting book-author relation:', err);
        res.status(500).send('Error inserting book-author relation');
        return;
      }

      relationsProcessed++;

      if (relationsProcessed === authorIds.length + categoryIds.length + keywordIds.length) {
        res.send('Book insertion completed successfully');
      }
    });
  });

  keywordIds.forEach(keywordId => {
    connection.query(insertBookKeywordQuery, [bookId, keywordId], (err, result) => {
      if (err) {
        console.error('Error inserting book-author relation:', err);
        res.status(500).send('Error inserting book-author relation');
        return;
      }

      relationsProcessed++;

      if (relationsProcessed === authorIds.length + categoryIds.length + keywordIds.length) {
        res.send('Book insertion completed successfully');
      }
    });
  });
  // Similar modifications need to be done for insertBookCategoryQuery and insertBookKeywordQuery

  // Move the insertCopyQuery logic to a separate function insertCopies and handle the response there
}

// Rental History
app.get('/RentalHistory', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;
      const name = req.query.name; // Get the input name from the query parameter
      const title = req.query.title;

      const rentIdQuery = 'SELECT rent_id FROM rental r join user u on u.user_id = r.user_id where u.school_id = ? and r.status <> "late"';
      const rentDetailsQuery = 'SELECT * FROM rental where rent_id = ?';

      connection.query(rentIdQuery, [schoolId], (err, rentsID) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        const rentIDs = rentsID.map(rent => rent.rent_id); // Extracting the book IDs

      let Allquery = `
      SELECT 
      r.rent_id as rent_id,
      u.first_name as first_name,
      u.last_name as last_name,
      b.title as title,
      DATE_FORMAT(r.take_date, '%Y-%m-%d') as take_date,
      r.status as status
      FROM rental r
        inner join copy c on r.copy_id = c.copy_id
        inner join book b on c.book_id = b.book_id
        INNER JOIN user u ON u.user_id = r.user_id
      WHERE r.rent_id IN (?)`;
    
      const queryValues = [ rentIDs ]; // Array to store query values

      if (name) {
        Allquery += ' AND u.last_name LIKE ?'; // Add the additional filter for name
        queryValues.push(`%${name}%`); // Add the value for the name filter
      }
      if (title) {
        Allquery += ' AND b.title LIKE ?'; // Add the additional filter for name
        queryValues.push(`%${title}%`); // Add the value for the name filter
      }

      Allquery += ' order BY r.rent_id';

        // Fetch book details for each book separately
        const fetchRentDetails = (rentId) => {
          return new Promise((resolve, reject) => {
            connection.query(rentDetailsQuery, [rentId], (err, rentDetails) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                resolve(rentDetails[0]);
              }
            });
          });
        };

        connection.query(Allquery, queryValues, (err, results) => {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
          }

          const rentDetailsPromises = rentIDs.map(rentId => fetchRentDetails(rentId));
        
          Promise.all(rentDetailsPromises)
            .then(rentDetails => {
              const rentsDetails = results.map(result => {
                const rentId = result.rent_id;
                const rentDetail = rentDetails.find(detail => detail.rent_id === rentId);
                
                const title = result.title;
                const take_date = result.take_date;
                const status = result.status;

                return {
                  rent_id: rentId,
                  first_name: result.first_name,
                  last_name: result.last_name,
                  title: title,
                  take_date: take_date,
                  status: status
                };
              });
        
              res.json({ rentsDetails });
              console.log({ rentsDetails });
            })
            .catch(error => {
              console.error(error);
              res.status(500).json({ error: 'Internal server error' });
            });
        });
        

      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/return', (req, res) => {
  const rent_id = req.body.rent_id;

  const Query = 'insert into returns (rent_id) VALUES (?)';

  connection.query(Query, [ rent_id ], (err, acceptResults) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.json({ message: 'Rental accepted!!!!' });
  });
})

app.get('/ResHistory', (req, res) => {
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      // parse the user info from the cookie
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;
      const name = req.query.name; // Get the input name from the query parameter
      const title = req.query.title;

      const resIdQuery = 'SELECT rent_id FROM reservation r join user u on r.user_id = u.user_id where u.school_id = ?';
      const resDetailsQuery = 'SELECT * FROM reservation where rent_id = ?';

      connection.query(resIdQuery, [schoolId], (err, ressID) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        const resIDs = ressID.map(res => res.rent_id); // Extracting the book IDs

      let Allquery = `
      SELECT 
      r.rent_id as rent_id,
      u.first_name as first_name,
      u.last_name as last_name,
      b.title as title,
      DATE_FORMAT(r.reserved_for, '%Y-%m-%d') as take_date,
      r.status as status
      FROM reservation r
        inner join book b on r.book_id = b.book_id
        INNER JOIN user u ON r.user_id = u.user_id
      WHERE r.rent_id IN (?)`;
    
      const queryValues = [ resIDs ]; // Array to store query values

      if (name) {
        Allquery += ' AND u.last_name LIKE ?'; // Add the additional filter for name
        queryValues.push(`%${name}%`); // Add the value for the name filter
      }
      if (title) {
        Allquery += ' AND b.title LIKE ?'; // Add the additional filter for name
        queryValues.push(`%${title}%`); // Add the value for the name filter
      }

      Allquery += ' order BY r.rent_id';

        // Fetch book details for each book separately
        const fetchResDetails = (resId) => {
          return new Promise((resolve, reject) => {
            connection.query(resDetailsQuery, [resId], (err, resDetails) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                resolve(resDetails[0]);
              }
            });
          });
        };

        connection.query(Allquery, queryValues, (err, results) => {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
          }

          const resDetailsPromises = resIDs.map(resId => fetchResDetails(resId));
        
          Promise.all(resDetailsPromises)
            .then(resDetails => {
              const ressDetails = results.map(result => {
                const resId = result.rent_id;
                const resDetail = resDetails.find(detail => detail.rent_id === resId);
                
                const title = result.title;
                const take_date = result.take_date;
                const status = result.status;

                return {
                  rent_id: resId,
                  first_name: result.first_name,
                  last_name: result.last_name,
                  title: title,
                  take_date: take_date,
                  status: status
                };
              });
        
              res.json({ ressDetails });
              console.log({ ressDetails });
            })
            .catch(error => {
              console.error(error);
              res.status(500).json({ error: 'Internal server error' });
            });
        });
        

      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/delays', (req, res) => {

  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try {
      const user = JSON.parse(req.cookies.user);
      const schoolId = user.school_id;
      const delaysQuery = `
      SELECT u.first_name, u.last_name, b.title, r.copy_id, 
      r.take_date, r.rent_id
      FROM rental r
      INNER JOIN user u ON r.user_id = u.user_id
      INNER JOIN copy c ON r.copy_id = c.copy_id
      INNER JOIN book b ON r.book_id = b.book_id
      WHERE r.status = 'late' and u.school_id = ?
    `;
    connection.query(delaysQuery, [schoolId], (err, results) => {
      if (err) {
        console.error('Error fetching delays data:', err);
        res.status(500).json({ error: 'Failed to fetch delays data' });
        return;
      }
  
      // Send the delays data as the response
      console.log({ delays: results });
      res.json({ delays: results });
    });
    
} catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }

  
});



//fetchers of the admin
app.get('/fetchRPM', (req, res) => {
      let RPMQuery = 'select s.name as school, count(*) as total_rentals, date_format(r.take_date, "%b %Y") as month';
      RPMQuery += ' from school s join moderator m on m.school_id = s.school_id join rental r on r.mod_id = m.mod_id';
      RPMQuery += ' where r.status not in ("queued up", "terminated") group by s.school_id, month having month is not null order by total_rentals desc, school asc';

      connection.query(RPMQuery, [], (err, RPMsID) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
    
        const RPMsData = RPMsID.map(RPM => ({
          school: RPM.school,
          total_rentals: RPM.total_rentals,
          month: RPM.month
        }));
    
        // Store the RPMsData or perform further operations
    
        res.json({ RPMsData });
        console.log({ RPMsData });
      });
});

app.get('/fetchNRA', (req, res) => {
  let NRAQuery = 'select a.name as author, (select count(distinct ba.book_id) from book_author ba where ba.author_id=a.author_id) as total_books';
  NRAQuery += ' from author a left join book_author ba on a.author_id = ba.author_id';
  NRAQuery += ' left join book b on ba.book_id = b.book_id left join copy c on b.book_id = c.book_id';
  NRAQuery += ' left join rental r on c.copy_id = r.copy_id group by a.author_id having count(r.rent_id) = 0';
  NRAQuery += ' order by 1;';

  connection.query(NRAQuery, [], (err, NRAsID) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    const NRAsData = NRAsID.map(NRA => ({
      author: NRA.author,
      total_books: NRA.total_books
    }));

    res.json({ NRAsData });
    console.log({ NRAsData });
  });
});

app.get('/fetchTopCategoriesPairs', (req, res) => {
  let TCPQuery = 'select concat(c1.name, "-", c2.name ) as pair, count(r.rent_id) as total_rentals from category c1 join category c2';
  TCPQuery += ' join book_category bc1 on bc1.category_id = c1.category_id join book_category bc2 on bc2.category_id = c2.category_id';
  TCPQuery += ' join book b1 on b1.book_id = bc1.book_id join book b2 on b2.book_id = bc2.book_id';
  TCPQuery += ' join copy c on b1.book_id = c.book_id join rental r on r.copy_id = c.copy_id';
  TCPQuery += ' where b1.book_id = b2.book_id and c1.category_id < c2.category_id group by c1.name, c2.name order by 2 desc limit 1, 3;';

  connection.query(TCPQuery, [], (err, TCPsID) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    const TCPsData = TCPsID.map(TCP => ({
      pair: TCP.pair,
      total_rentals: TCP.total_rentals
    }));

    res.json({ TCPsData });
    console.log({ TCPsData });
  });
});

app.get('/fetchYoungReaders', (req, res) => {
    let YRQuery = 'select concat(u.first_name, " ", u.last_name) as teacher_name, count(*) as total_books,';
    YRQuery += ' floor(datediff(curdate(), birthdate) / 365) as age from user u join rental r on r.user_id = u.user_id';
    YRQuery += ' where u.role = "teacher" and u.birthdate >= date_sub(current_date(), interval 40 year)';
    YRQuery += ' group by u.user_id ';
    YRQuery += ' order by total_books desc';
    YRQuery += ' limit 10 ';

    connection.query(YRQuery, [], (err, YRsID) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }

        const YRsData = YRsID.map(YR => ({
            teacher_name: YR.teacher_name,
            total_books: YR.total_books,
            age: YR.age,
        }));

        res.json({ YRsData });
        console.log({ YRsData });
    });
});

app.get('/fetchFTTP', (req, res) => {
    let FTTPQuery = 'select a.name as author_name, count(distinct ba.book_id) as total_books';
    FTTPQuery += ' from author a join book_author ba on ba.author_id = a.author_id';
    FTTPQuery += ' join book b on b.book_id = ba.book_id';
    FTTPQuery += ' group by a.author_id ';
    FTTPQuery += ' having total_books <= (select count(*) - 5  from author a1 join book_author ba1 on ba1.author_id = a1.author_id group by a1.author_id order by count(*) desc limit 1) ';
    FTTPQuery += ' order by total_books desc';

    connection.query(FTTPQuery, [], (err, FTTPsID) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }

        const FTTPsData = FTTPsID.map(FTTP => ({
            author_name: FTTP.author_name,
            total_books: FTTP.total_books
        }));

        res.json({ FTTPsData });
        console.log({ FTTPsData });
    });
});


app.get('/fetchmax', (req, res) => {
    let maxQuery = 'select count(*) as max_author from author a';
    maxQuery += ' join book_author ba on ba.author_id = a.author_id';
    maxQuery += ' group by a.author_id ';
    maxQuery += ' order by count(*) desc';
    maxQuery += ' limit 1';

    connection.query(maxQuery, [], (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }

        const maxsData = result;

        res.json({ maxsData });
        console.log({ maxsData });
    });
});

app.get('/fetchMTT', (req, res) => {
    let MTTQuery = 'select concat(m.first_name, " ", m.last_name) as mod_name, COUNT(*) as total_rentals';
    MTTQuery += ' from moderator m join rental r on r.mod_id = m.mod_id';
    MTTQuery += ' where r.take_date between DATE_SUB(CURDATE(), interval 1 year) and CURDATE()';
    MTTQuery += ' group by m.mod_id having total_rentals > 20'
    MTTQuery += ' order by total_rentals desc;'

    connection.query(MTTQuery, [], (err, MTTsID) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }

        const MTTsData = MTTsID.map(MTT => ({
            mod_name: MTT.mod_name,
            total_rentals: MTT.total_rentals
        }));

        res.json({ MTTsData });
        console.log({ MTTsData });
    });
});

app.get('/fetchMods', (req, res) => {
      // parse the user info from the cookie
    let ModReqQuery = 'select (select count(*) from moderator mo where mo.school_id=s.school_id and mo.verification=true) as active_mods,';
    ModReqQuery += ' m.mod_id as mod_id, concat(m.first_name, " ", m.last_name) as mod_name, c.email as email';
    ModReqQuery += ' ,s.name as school, c.telephone as telephone, c.address as address,';
    ModReqQuery += ' m.verification as verification';
    ModReqQuery += ' from moderator m join contact c on c.contact_id = m.contact_id';
    ModReqQuery += ' join school s on s.school_id = m.school_id;';

    connection.query(ModReqQuery, [], (err, modsID) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }

        const modsData = modsID.map(mod => ({
            mod_id: mod.mod_id,
            mod_name: mod.mod_name,
            email: mod.email,
            school: mod.school,
            telephone: mod.telephone,
            address: mod.address,
            verification: mod.verification,
            active_mods: mod.active_mods
        }));

        res.json({ modsData });
        console.log({ modsData });
    });
});

app.post('/cancelMod', (req, res) => {
  const mod_id = req.body.mod_id;

  const cancelQuery = 'update moderator set verification = false where mod_id = ?';

  connection.query(cancelQuery, [ mod_id ], (err, CancelsResults) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.json({ message: 'Rental completed!!!!' });
  });
})

app.post('/verMod', (req, res) => {
  const mod_id = req.body.mod_id;

  const cancelQuery = 'update moderator set verification = true where mod_id = ?';

  connection.query(cancelQuery, [ mod_id ], (err, CancelsResults) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.json({ message: 'Rental completed!!!!' });
  });
})

app.post('/CreateNewSchool', function(req, res) {

  const { school, address, city, postal_code, telephone, email, principal } = req.body;
  
  //insert the contact information into the contact table
  const contactQuery = 'INSERT INTO contact (email, address, postal_code, city, telephone) VALUES (?, ?, ?, ?, ?)';
  connection.query(contactQuery, [email, address, postal_code, city, telephone], function(err, contactResult){
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Internal server error'});
    }

    // get the generated contact ID
    const contact_id = contactResult.insertId;

    const schoolQuery = 'INSERT INTO school (name, principal, contact_id) VALUES (?, ?, ?)';
    connection.query(schoolQuery, [school, principal, contact_id], function(err, schoolResult){
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error'});
      }
      else {
        res.json({ message: 'Rating completed!!!!' });
      }
    })
  })
})

app.get('/fetchCAT', (req, res) => {
  const category = req.query.category; // Get the input category from the query parameter

  if (!category) {
      res.json({ CATsData: [] }); // Return empty response if category is undefined
      return;
  }

  let CATQuery = `
  SELECT DISTINCT a.name AS author_name
  FROM author a
  JOIN book_author ba ON ba.author_id = a.author_id
  JOIN book b ON b.book_id = ba.book_id
  JOIN book_category bc ON bc.book_id = b.book_id
  JOIN category c ON c.category_id = bc.category_id
  WHERE c.name = ?`;
  const queryValues = [category]; // Array to store query values

  connection.query(CATQuery, queryValues, (err, CATsID) => {
      if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
      }

      const CATsData = CATsID.map(CAT => ({
          author_name: CAT.author_name
      }));

      res.json({ CATsData });
      console.log({ CATsData });
  });
});

app.get('/fetchTeacher', (req, res) => {
  const category = req.query.category; // Get the input category from the query parameter

  if (!category) {
      res.json({ TeachersData: [] }); // Return empty response if category is undefined
      return;
  }

  let TeacherQuery = `
 select concat(u.first_name, ' ', u.last_name) as teacher_name
  from user u
   join rental r on u.user_id = r.user_id
   join copy c on c.copy_id = r.copy_id
   join book b on b.book_id = c.book_id
   join book_category bc on bc.book_id = b.book_id
   join category ct on ct.category_id = bc.category_id
  where ct.name = ? and r.take_date between DATE_SUB(CURDATE(), interval 1 year) and CURDATE() and u.role = 'teacher'
  group by u.user_id`;
  const queryValues = [category]; // Array to store query values

  connection.query(TeacherQuery, queryValues, (err, TeachersID) => {
      if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
      }

      const TeachersData = TeachersID.map(Teacher => ({
          teacher_name: Teacher.teacher_name
      }));

      res.json({ TeachersData });
      console.log({ TeachersData });
  });
});

//Profil section
app.get('/profil', (req, res) => {
  // check if the cookie exists
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try{
    // parse the user info from the cookie 
    const user = JSON.parse(req.cookies.user); 
    
const  username = user.username;
const schoolId = user.school_id;
const role = user.capacity;

    //Query the database to fetch the school name using the school_id
    const schoolQuery = 'SELECT name FROM school WHERE school_id = ?';
    const UserQuerry = `SELECT DISTINCT
    u.first_name AS firstName, 
    u.last_name AS lastName,
    u.password AS password,
    co.email AS email,
    co.address AS address,
    co.city AS city,
    co.postal_code AS postalCode,
    co.telephone AS telephone 
    FROM 
    user u
    INNER JOIN contact co ON u.contact_id = co.contact_id
    WHERE u.username = ?
    `;
    connection.query(schoolQuery, [schoolId], (err, results) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error'});
        return;
      } else {
        const schoolName = results[0].name;
        connection.query(UserQuerry, [username], (err, alldata) => {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error'});
          } 
            const responseData = {
                  username: username, 
                  schoolName: schoolName,
                  role: role, 
                  firstName: alldata[0].firstName,
                  lastName: alldata[0].lastName,
                  password: alldata[0].password,
                  email: alldata[0].email,
                  address: alldata[0].address,
                  city: alldata[0].city,
                  postalCode: alldata[0].postalCode,
                  telephone: alldata[0].telephone
             };
             res.json({ responseData});
             console.log({responseData});
        });
       
      
       
       
      };
      
    });
  }   catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
  } else {
     res.status(401).json({ error: 'Unathorized'});
  }
});



//Update the profile data
app.post('/update-profile', function(req, res) {
    // check if the cookie exists
  if (req.cookies.user) {
    console.log('req.cookies.user:', req.cookies.user);
    try{
    // parse the user info from the cookie 
    const user = JSON.parse(req.cookies.user); 

    const  userID = user.userID;
    const ContactIDQuery = 'SELECT contact_id FROM user WHERE user_id = ?';
    const setUserdata1 = 'UPDATE user SET first_name = ?, last_name = ?, username = ? WHERE contact_id = ?';
    const setUserdata2 = 'UPDATE contact SET email = ?, address = ?, city = ?, postal_code = ? WHERE contact_id = ?';
      connection.query(ContactIDQuery, [userID], (err, results) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error'});
          return;
        }   
        const contact_id = results[0].contact_id;
        console.log(contact_id);
  const {
    firstName,
    lastName,
    email,
    username,
    schoolName,
    address,
    city,
    postalCode
  } = req.body;
  console.log(username);
  connection.query(
    setUserdata1,
    [firstName, lastName, username, contact_id], // Replace contactId with the actual contact ID from the user record
    function(err, result) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'An error occurred while updating the profile' });
      } else {
        // Update the "contact" table
        connection.query(
          setUserdata2,
          [email, address, city, postalCode, contact_id], // Replace contactId with the actual contact ID from the user record
          function(err, result) {
            if (err) {
              console.error(err);
              res.status(500).json({ error: 'An error occurred while updating the profile' });
            } else {
              res.status(200).json({ message: 'Profile updated successfully' });
            }
          }
        );
      }
    }
  );
});
}
catch (error) {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
}
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

//Update password 
app.post('/update-password', function(req, res) {
  // check if the cookie exists
if (req.cookies.user) {
  console.log('req.cookies.user:', req.cookies.user);
  try{
  // parse the user info from the cookie 
  const user = JSON.parse(req.cookies.user); 

  const  userID = user.userID;
  const { newPassword } = req.body;

  // Validate the request
  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required' });
  }


  // Update the password in the database
  const sql = 'UPDATE user SET password = ? WHERE user_id = ?';
  const values = [newPassword, userID];

  console.log(values);
  connection.query(sql, values, (error, results) => {
    if (error) {
      console.error('Error updating password:', error);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    // Password updated successfully
    res.status(200).json({ message: 'Password updated successfully' });
  });
}
catch (error) {
console.error(error);
res.status(500).json({ error: 'Internal server error' });
}
} else {
  res.status(401).json({ error: 'Unauthorized' });
}
});
