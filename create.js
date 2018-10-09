var sql = require('sqlite3');

// create database
var db = new sql.Database('grids.sqlite');

db.serialize(function() {

  // making the table
  db.run("CREATE TABLE grids (id integer, gridName varchar, username varchar, grid varchar)");

  // // // adding data
  // var exDate = new Date(1998, 4, 30, 00, 00, 00);
  // var sqlDate = exDate.toISOString();
  // db.run("INSERT INTO times VALUES (1, '5/30/1998', '00:00', '" + sqlDate+ "')");
  // // db.run("INSERT INTO movies VALUES ('jkl321', 'Guardians 2', 7)");
  // // db.run("INSERT INTO movies VALUES ('randomExample', 'Wonder Woman', 10)");

  // // verify we can query data
  // db.each("SELECT * FROM times WHERE id = 1", function(err, row) {
  //     console.log( JSON.stringify(row) );
  //     var temp = new Date(row.dateObj);
  //     console.log(temp);
  // });



});

db.close();
