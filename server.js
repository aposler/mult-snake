var http = require('http')
  , fs = require('fs')
  , url = require('url')
  , sql = require('sqlite3')
  , socketIO = require('socket.io')
  , port = 8080
  , querystring = require('querystring');

//var db = new sql.Database('grids.sqlite')
var gameObjs = [];

//const { DATABASE_URL } = process.env;
var io = socketIO(server);
var server = http.createServer(function (req, res) {
  if (req.method === 'POST') {
    var body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    //   req.on('end', () => {
    //     var jsonData = JSON.parse(body);
    //     if (jsonData.requestType === "add") {
    //       addGrid(res, jsonData);
    //     } else if (jsonData.requestType === "request") {
    //       returnNames(res, jsonData);
    //     } else if (jsonData.requestType === "grid") {
    //       returnGrid(res, jsonData);
    //     }
    //   })
  } else {
    var uri = url.parse(req.url)
    switch (uri.pathname) {
      case '/':
        sendFile(res, 'public/index.html')
        break
      case '/index.html':
        sendFile(res, 'public/index.html')
        break
      case '/styles/style.css':
        sendFile(res, 'public/styles/style.css', 'text/css')
        break
      case '/scripts/main.js':
        sendFile(res, 'public/scripts/main.js', 'text/javascript')
        break
      default:
        res.end('404 not found')
    }
  }
})

server.listen(process.env.PORT || port);
console.log('listening on 8080')

// subroutines
// NOTE: this is an ideal place to add your data functionality

function sendFile(res, filename, contentType) {
  contentType = contentType || 'text/html';

  fs.readFile(filename, function (error, content) {
    res.writeHead(200, { 'Content-type': contentType })
    res.end(content, 'utf-8')
  })

}

//Finds the smallest number not currently used as an id in the database "db" 
function findUserId(gameObj) {
  var existsFlags = [];
  for (i = 0; i < gameObj.players.length; ++i) {
    existsFlags[gameObj.players[i].id - 1] = 1;
  }
  var newKey = 0;
  while (existsFlags[newKey]) {
    newKey++;
  }
  return newKey + 1;
}

var io = socketIO(server);
io.on('connect', addPlayer);

function addPlayer(socket) {
  if (gameObjs.length === 0) {
    let tempGame = initGame();
    gameObjs.push(tempGame);
  }

  let smallObj = { 'players': { 'length': 100 } };
  let i = 0;
  for (; i < gameObjs.length; ++i) {
    if (gameObjs[i].players.length < smallObj.players.length) {
      smallObj = gameObjs[i];
    }
  }
  //let newId = findUserId(smallObj);
  let playerObj = {};
  let snakeHead = findSpawnPoint(smallObj);
  let objsChecked = 1;
  if (!snakeHead) {
    smallObj = findNewObj(i);
  }

  playerObj.socketId = socket.id;
  playerObj.id = findUserId(smallObj);
  playerObj.snake = [snakeHead];
  playerObj.direction = getDefaultDir(snakeHead);
  //playerObj.snakeTail = snakeHead;
  playerObj.compact = 2; //How many blocks are layered on top of each other right now
  smallObj.grid[snakeHead.y][snakeHead.x] = playerObj.id;
  smallObj.players.push(playerObj);
  smallObj.occupiedSpots = smallObj.occupiedSpots + 1;
  io.to(socket.id).emit('initState', { 'grid': smallObj.grid, 'id': playerObj.id });

  socket.on('movement', function (direction) {
    // for(let i = 0; i < gameObjs.length; ++i){
    //   let gameObj = gameObjs[i];
    //   for(let j = 0; j < gameObj.players.length; ++j){
    //     if(gameObj.players[j].socketId === socket.id){
    playerObj.direction = direction;
    //update(smallObj);
    // }
    // }
    // }
  });
}

function findNewObj(oldIndex) {
  let newI = 0;
  if (oldIndex === 0) {
    newI = 1;
  }
  let newObj = null;
  let snakeHead = false;
  for (; newI < gameObjs.length && !snakeHead; ++newI) {
    newObj = gameObjs[newI];
    snakeHead = findSpawnPoint(newObj);
  }
  if (!snakeHead) {
    newObj = initGame();
    gameObjs.push(newObj);
  }
  return newObj
}

function getDefaultDir(snakeHead) {
  if (snakeHead.x === 0) {
    return 'up';
  } else if (snakeHead.y === 0) {
    return 'right';
  } else if (snakeHead.x > 0) {
    return 'down';
  } else if (snakeHead.y > 0) {
    return 'left';
  }
}

function findSpawnPoint(gameObj) {
  let grid = gameObj.grid;
  for (let i = 0; i < grid.length; ++i) {
    for (let j = 0; j < grid[i].length; ++j) {
      if ((grid[i][j] + grid[i][j + 1] + grid[i][j + 2] + grid[i][j + 3]) === 0) {
        return { 'y': i, 'x': j };
      }
    }
  }
  return null;
}

function initGame() {
  let game = {};
  let tempGrid = [];
  for (var j = 0; j < 100; ++j) {
    tempGrid.push([]);
    tempGrid[j].length = 100;
    tempGrid[j].fill(0);
  }
  game.grid = tempGrid;
  game.players = [];
  game.occupiedSpots = 0;
  generateFood(game);
  generateFood(game);
  setInterval(function () {
    update(game);
  }, 300);
  return game;
}

function update(gameObj) {
  let grid = gameObj.grid;
  let changedVars = [];
  let gameEnds = [];
  let foodEaten = 0;
  console.log("there are " + gameObj.players.length + " players");
  for (let i = 0; i < gameObj.players.length; ++i) {
    let curPlayer = gameObj.players[i];
    let newHead = getNewHeadLoc(curPlayer.snake[0], curPlayer.direction);
    //curPlayer.snake.unshift(newHead);
    console.log(curPlayer);
    let tailVal = curPlayer.snake[curPlayer.snake.length - 1];
    if (grid[newHead.y][newHead.x] !== 20 && curPlayer.compact <= 0) { //isn't 'food' or any layered blocks
      if (grid[tailVal.y][tailVal.x] === curPlayer.id) {
        grid[tailVal.y][tailVal.x] = 0;
        changedVars.push({ 'y': tailVal.y, 'x': tailVal.x, 'val': 0 });
      }
      curPlayer.snake.splice(-1, 1);
    } else { //there are either layered blocks or he ate food
      let tempCompact = false;
      if (curPlayer.compact > 0) {
        tempCompact = true;
      }
      if (grid[newHead.y][newHead.x] === 20) {
        ++foodEaten;
        gameObj.occupiedSpots = gameObj.occupiedSpots - 1;
      }
      if (grid[newHead.y][newHead.x] === 20 && curPlayer.compact > 0) {
        curPlayer.compact = curPlayer.compact + 1;
      }
      if (tempCompact) {
        curPlayer.compact = curPlayer.compact - 1;
      }
    }
    grid[newHead.y][newHead.x] = curPlayer.id;
    changedVars.push({ 'y': newHead.y, 'x': newHead.x, 'val': curPlayer.id });
    curPlayer.snake.unshift(newHead);
  }
  let contactChanges = checkForContact(gameObj);
  if (contactChanges) {
    changedVars.concat(contactChanges.changed);
  }
  for (let i = 0; i < foodEaten; ++i) {
    changedVars.push(generateFood(gameObj));
    gameObj.occupiedSpots = gameObj.occupiedSpots - 1;
  }
  io.sockets.emit('update', { 'grid': gameObj.grid, 'changes': changedVars });
}

function checkForContact(gameObj) {
  let changedVars = []
  for (let i = 0; i < gameObj.players.length; ++i) {
    let curPlayer = gameObj.players[i];
    let snakeHeadX = curPlayer.snake[0].x;
    let snakeHeadY = curPlayer.snake[0].y;
    let snakeContacts = isInSnake(snakeHeadX, snakeHeadY, curPlayer.id, gameObj);
    changedVars.concat(performContact(snakeHeadX, snakeHeadY, snakeContacts, curPlayer, gameObj));
  }
  return changedVars;
}

function isInSnake(headX, headY, curId, gameObj) {
  let grid = gameObj.grid;
  let potenIds = [];
  if (headY - 1 >= 0 && grid[headY - 1][headX] !== 0 &&
    grid[headY - 1][headX] !== curId) {
    potenIds.push(grid[headY - 1][headX]);
  }
  if (headY + 1 <= 99 && grid[headY + 1][headX] !== 0 &&
    grid[headY + 1][headX] !== curId) {
    potenIds.push(grid[headY + 1][headX]);
  }
  if (headX - 1 >= 0 && grid[headY][headX - 1] !== 0 &&
    grid[headY][headX - 1] !== curId) {
    potenIds.push(grid[headY][headX - 1]);
  }
  if (headX + 1 <= 99 && grid[headY][headX + 1] !== 0 &&
    grid[headY][headX + 1] !== curId) {
    potenIds.push(grid[headY][headX + 1]);
  }
  let snakeContacts = [];
  for (let i = 0; i < gameObj.players.length; ++i) {
    for (let j = 0; j < potenIds.length; ++j) {
      if (gameObj.players[i].id === potenIds[j]) {
        console.log(JSON.stringify(potenIds) + " is potenIds with curId " + curId);
        snakeContacts.push(gameObj.players[i]);
      }
    }
  }
  return snakeContacts;
}

function performContact(headX, headY, snakeContacts, curPlayer, gameObj) {
  let grid = gameObj.grid;
  for (let i = 0; i < snakeContacts.length; ++i) {
    console.log(JSON.stringify(snakeContacts) + " with player " + JSON.stringify(curPlayer) + " and coords x=" + headX + " and y=" + headY);
    let curContact = snakeContacts[i];
    let curSnake = curContact.snake;
    for (let j = 0; j < curSnake.length; ++j) {
      let curNode = curSnake[j];
      if (curNode.x === headX && curNode.y === headY && j === 0) {
        return performGameEnd([curPlayer, curContact], gameObj);
      } else if (curNode.x === headX && curNode.y === headY) {
        return removeSnakeNodes(curContact, j, gameObj);
      }
    }
  }
}

function removeSnakeNodes(player, nodeIndex, gameObj) {
  console.log("removeSnakeNodes");
  let grid = gameObj.grid;
  let changedNodes = [];
  let snake = player.snake;
  for (let i = nodeIndex; i < snake.length; ++i) {
    let curNode = snake[i];
    if (grid[curNode.y][curNode.x] === player.id) {
      grid[curNode.y][curNode.x] = 0;
      changedNodes.push({ 'y': curNode.y, 'x': curNode.x });
      gameObj.occupiedSpots = gameObj.occupiedSpots - 1;
    }
  }
  snake.length = nodeIndex;
  let temp = { 'end': [], 'changed': changedNodes };
  console.log(temp);
  return { 'end': [], 'changed': changedNodes };
}

function performGameEnd(endedPlayers, gameObj) {
  console.log("gameEnd");
  let grid = gameObj.grid;
  let changedNodes = [];
  for (let i = 0; i < endedPlayers.length; ++i) {
    let curPlayer = endedPlayers[i];
    let curSnake = curPlayer.snake;
    for (let j = 0; j < curSnake.length; ++j) {
      let curNode = curSnake[j];
      if (grid[curNode.y][curNode.x] === curPlayer.id) {
        grid[curNode.y][curNode.x] = 0;
        changedNodes.push({ 'y': curNode.y, 'x': curNode.x });
      }
    }
  }
  return { 'end': endedPlayers, 'changed': changedNodes };
}

function getNewHeadLoc(snakeHead, direction) {
  let newHead = { 'y': snakeHead.y, 'x': snakeHead.x };
  if (direction === 'up') {
    newHead.y = newHead.y - 1;
    if (newHead.y < 0) {
      newHead.y = 99;
    }
  } else if (direction === 'right') {
    newHead.x = newHead.x + 1;
    if (newHead.x > 99) {
      newHead.x = 0;
    }
  } else if (direction === 'down') {
    newHead.y = newHead.y + 1;
    if (newHead.y > 99) {
      newHead.y = 0;
    }
  } else if (direction === 'left') {
    newHead.x = newHead.x - 1;
    if (newHead.x < 0) {
      newHead.x = 99;
    }
  }
  return newHead;
}

function generateFood(gameObj) {
  let grid = gameObj.grid;
  let foodLoc = Math.floor((Math.random() * (10000 - gameObj.occupiedSpots)) + 1);
  for (let i = 0; i < grid.length; ++i) {
    for (let j = 0; j < grid[i].length; ++j) {
      if (grid[i][j] === 0) {
        --foodLoc;
      }
      if (foodLoc === 0) {
        gameObj.grid[i][j] = 20;
        gameObj.occupiedSpots = gameObj.occupiedSpots + 1;
        return { 'y': i, 'x': j };
      }
    }
  }
};

