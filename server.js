var http = require('http')
  , fs = require('fs')
  , url = require('url')
  , sql = require('sqlite3')
  , socketIO = require('socket.io')
  , port = 8080
  , querystring = require('querystring');

var gameObjs = [];

var io = socketIO(server);
var server = http.createServer(function (req, res) {
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
});

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

//Finds the smallest number not currently used as an player id in the given gameObj
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

//Add player to an open game. If no game is open, create a new game, and if multiple are open pick the one
//with the lowest player count
function addPlayer(socket) {
  let playerObj = { 'name': 'placeholder' };

  socket.on('username', function (username) {
    playerObj.name = username;
  });

  io.to(socket.id).emit('connected');

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

  let snakeHead = findSpawnPoint(smallObj);
  let objsChecked = 1;
  if (!snakeHead) {
    smallObj = findNewObj(i);
  }

  playerObj.socketId = socket.id;
  playerObj.id = findUserId(smallObj);
  playerObj.snake = [snakeHead];
  playerObj.direction = getDefaultDir(snakeHead);
  playerObj.oldDir = playerObj.direction;
  playerObj.compact = 2; //How many blocks are layered on top of each other right now
  smallObj.grid[snakeHead.y][snakeHead.x] = playerObj.id;
  smallObj.players.push(playerObj);
  smallObj.occupiedSpots = smallObj.occupiedSpots + 1;
  let playerScores = [];
  for (let i = 0; i < smallObj.players.length; ++i) {
    let curPlayer = smallObj.players[i];
    playerScores.push({
      'id': curPlayer.id,
      'score': curPlayer.snake.length + curPlayer.compact,
      'name': curPlayer.name
    });
  }
  io.to(socket.id).emit('initState', {
    'grid': smallObj.grid,
    'id': playerObj.id,
    'winSnake': smallObj.winSnake,
    'playerVals': playerScores
  });

  socket.on('movement', function (direction) {
    if ((playerObj.oldDir === 'up' && direction === 'down') ||
      (playerObj.oldDir === 'down' && direction === 'up') ||
      (playerObj.oldDir === 'left' && direction === 'right') ||
      (playerObj.oldDir === 'right' && direction === 'left')) {
      return;
    }
    playerObj.direction = direction;
  });

  socket.on('disconnect', function (direction) {
    for (let i = 0; i < smallObj.players.length; ++i) {
      if (smallObj.players[i].id === playerObj.id) {
        gameEndSnake(smallObj, i);
        return;
      }
    }
  });

}

//find an object with an available spawn point 
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

//Get the default direction of the snake, which depends on which edge it's
//on. Top goes right, right goes down, down goes left, and left goes up
function getDefaultDir(snakeHead) {
  if (snakeHead.x === 0 && snakeHead.y !== 0) {
    return 'up';
  } else if (snakeHead.y === 0) {
    return 'right';
  } else if (snakeHead.x > 0) {
    return 'down';
  } else if (snakeHead.y > 0) {
    return 'left';
  }
}

//Finds the first point on the edge that has at least 3 open squares ahead of it
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

//Create the gameObj and return it. Initializes the grid, adds food to it,
//and begins updating it every 200ms
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
  game.winSnake = generateWinSnake();
  generateFood(game);
  generateFood(game);
  generateFood(game);
  generateFood(game);
  generateFood(game);
  generateFood(game);
  generateFood(game);
  generateFood(game);
  game.intervalId = setInterval(function () {
    if (game) {
      update(game);
    }
  }, 200);
  return game;
}

//Update the state of the game, and send the updated grid back out. 
//There is part of an implementation to send only changed value here, but
//I ran out of time to finish implementing it
function update(gameObj) {
  let grid = gameObj.grid;
  let changedVars = [];
  let gameEnds = [];
  let foodEaten = 0;
  //Move all the snakes, account for food and compacts
  for (let i = 0; i < gameObj.players.length; ++i) {
    let curPlayer = gameObj.players[i];
    curPlayer.oldDir = curPlayer.direction;
    let newHead = getNewHeadLoc(curPlayer.snake[0], curPlayer.direction);
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
    if (grid[newHead.y][newHead.x] === curPlayer.id) {  //the snake made contact with itself
      gameEnds.push(curPlayer);
    }
    grid[newHead.y][newHead.x] = curPlayer.id;
    changedVars.push({ 'y': newHead.y, 'x': newHead.x, 'val': curPlayer.id });
    curPlayer.snake.unshift(newHead);
  }

  //If any snakes where game ended (in this case they would have made contact with
  //themselves, remove them
  if (gameEnds.length > 0) {
    for (let i = 0; i < gameObj.players.length; ++i) {
      let curPlayer = gameObj.players[i];
      for (let j = 0; j < gameEnds.length; ++j) {
        let curEnd = gameEnds[j];
        if (curPlayer.id === curEnd.id) {
          gameEndSnake(gameObj, i);
          --i;
          break;
        }
      }
    }
  }

  //Check for any contacts between snakes, and update the grid/player objs
  //with them. Then return all game ended snakes and changed vars
  let contactChanges = checkForContact(gameObj);
  if (contactChanges) {
    changedVars = changedVars.concat(contactChanges.changed);
    gameEnds = gameEnds.concat(contactChanges.end);
  }

  //Game end all values returned with checkForcontact
  if (contactChanges.end.length > 0) {
    for (let i = 0; i < gameObj.players.length; ++i) {
      let curPlayer = gameObj.players[i];
      for (let j = 0; j < contactChanges.end.length; ++j) {
        let curEnd = contactChanges.end[j];
        if (curPlayer.id === curEnd.id) {
          gameEndSnake(gameObj, i);
          --i;
          break;
        }
      }
    }
  }
  let playerScores = [];

  //Regenerate all eaten food
  for (let i = 0; i < foodEaten; ++i) {
    changedVars.push(generateFood(gameObj));
    gameObj.occupiedSpots = gameObj.occupiedSpots - 1;
  }

  //Check if any players have won, and end the game if they have
  for (let i = 0; i < gameObj.players.length; ++i) {
    let curPlayer = gameObj.players[i];
    if (curPlayer.snake.length >= gameObj.winSnake.length) {
      if (checkSnakeShapes(gameObj.winSnake, curPlayer.snake)) { //curPlayer won
        for (let j = i; j < gameObj.players.length; ++j) {
          curPlayer = gameObj.players[j];
          playerScores.push({
            'id': curPlayer.id,
            'score': curPlayer.snake.length + curPlayer.compact,
            'name': curPlayer.name
          });
        }
        io.sockets.emit('update', {
          'grid': gameObj.grid,
          'changes': changedVars,
          'playerVals': playerScores
        });
        clearInterval(gameObj.intervalId);
        io.sockets.emit('gameWon', { 'id': curPlayer.id, 'name': curPlayer.name });
        for (let j = 0; j < gameObj.players.length; ++j) {
          let curPlayer = gameObj.players[j];
          io.sockets.connected[curPlayer.socketId].disconnect();
        }
        for (let j = 0; j < gameObjs.length; ++j) {
          if (gameObjs[j] === gameObj) {
            gameObjs.splice(j, 1);
            break;
          }
        }
        return;
      }
    }
    playerScores.push({
      'id': curPlayer.id,
      'score': curPlayer.snake.length + curPlayer.compact,
      'name': curPlayer.name
    });
  }

  io.sockets.emit('update', {
    'grid': gameObj.grid,
    'changes': changedVars,
    'playerVals': playerScores
  });

  //Check if we still have and players, and if we don't delete the game
  if (gameObj.players.length === 0) {
    clearInterval(gameObj.intervalId);
    for (let j = 0; j < gameObjs.length; ++j) {
      if (gameObjs[j] === gameObj) {
        gameObjs.splice(j, 1);
        return;
      }
    }
  }
}

//Remove the player from the grid, the players array, and the socket. Also sends
//a gameEnd message to the player
function gameEndSnake(gameObj, playerLoc) {
  let grid = gameObj.grid;
  let curEnd = gameObj.players[playerLoc];
  for (let snakeSpot = 0; snakeSpot < curEnd.snake.length; ++snakeSpot) {
    let curNode = curEnd.snake[snakeSpot];
    if (grid[curNode.y][curNode.x] === curEnd.id) {
      grid[curNode.y][curNode.x] = 0;
      gameObj.occupiedSpots = gameObj.occupiedSpots - 1;
    }
  }
  gameObj.players.splice(playerLoc, 1);
  io.to(curEnd.socketId).emit('gameEnd', []);
  if (io.sockets.connected[curEnd.socketId]) {
    io.sockets.connected[curEnd.socketId].disconnect();
  }
}

//Implements all contacts between snakes in the given gameObj, and returns all changed spots
//and players who lost
function checkForContact(gameObj) {
  let changedVars = []
  let gameEnds = [];
  for (let i = 0; i < gameObj.players.length; ++i) {
    let curPlayer = gameObj.players[i];
    let snakeHeadX = curPlayer.snake[0].x;
    let snakeHeadY = curPlayer.snake[0].y;
    let snakeContacts = isInSnake(snakeHeadX, snakeHeadY, curPlayer.id, gameObj);
    let changedStruct = performContact(snakeHeadX, snakeHeadY, snakeContacts, curPlayer, gameObj);
    changedVars = changedVars.concat(changedStruct.changed);
    gameEnds = gameEnds.concat(changedStruct.end);
  }
  return { 'end': gameEnds, 'changed': changedVars };
}

//Check for all snakes that could have contacted location at headX and headY
function isInSnake(headX, headY, curId, gameObj) {
  let grid = gameObj.grid;
  let loopVal = grid.length - 1;
  let potenIds = [];
  if (headY - 1 < 0) {
    if (grid[loopVal][headX] !== 0 &&
      grid[loopVal][headX] !== curId) {
      potenIds.push(grid[loopVal][headX]);
    }
  } else {
    if (grid[headY - 1][headX] !== 0 &&
      grid[headY - 1][headX] !== curId) {
      potenIds.push(grid[headY - 1][headX]);
    }
  }

  if (headY + 1 > loopVal) {
    if (grid[0][headX] !== 0 &&
      grid[0][headX] !== curId) {
      potenIds.push(grid[0][headX]);
    }
  } else {
    if (grid[headY + 1][headX] !== 0 &&
      grid[headY + 1][headX] !== curId) {
      potenIds.push(grid[headY + 1][headX]);
    }
  }
  if (headX - 1 < 0) {
    if (grid[headY][loopVal] !== 0 &&
      grid[headY][loopVal] !== curId) {
      potenIds.push(grid[headY][loopVal]);
    }
  } else {
    if (grid[headY][headX - 1] !== 0 &&
      grid[headY][headX - 1] !== curId) {
      potenIds.push(grid[headY][headX - 1]);
    }
  }

  if (headX + 1 > loopVal) {
    if (grid[headY][0] !== 0 &&
      grid[headY][0] !== curId) {
      potenIds.push(grid[headY][0]);
    }
  } else {
    if (grid[headY][headX + 1] !== 0 &&
      grid[headY][headX + 1] !== curId) {
      potenIds.push(grid[headY][headX + 1]);
    }
  }

  let snakeContacts = [];
  for (let i = 0; i < gameObj.players.length; ++i) {
    for (let j = 0; j < potenIds.length; ++j) {
      if (gameObj.players[i].id === potenIds[j]) {
        snakeContacts.push(gameObj.players[i]);
      }
    }
  }
  return snakeContacts;
}

//Actually perform all the contacts on the grid
function performContact(headX, headY, snakeContacts, curPlayer, gameObj) {
  let grid = gameObj.grid;
  for (let i = 0; i < snakeContacts.length; ++i) {
    let curContact = snakeContacts[i];
    let curSnake = curContact.snake;
    for (let j = 0; j < curSnake.length; ++j) {
      let curNode = curSnake[j];
      if (curNode.x === headX && curNode.y === headY && j === 0) {
        return performGameEnd([curPlayer, curContact], gameObj);
      } else if (curNode.x === headX && curNode.y === headY && j === 1) {
        if (checkDir(curPlayer, curContact)) {
          return performGameEnd([curPlayer, curContact], gameObj);
        }
      } else if (curNode.x === headX && curNode.y === headY) {
        return removeSnakeNodes(curContact, j, gameObj);
      }
    }
  }
  return { 'end': [], 'changed': [] };
}

//Removes the snake nodes of a snake who had his tail eaten,
//and then return all the grid spots changed
function removeSnakeNodes(player, nodeIndex, gameObj) {
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
  return { 'end': [], 'changed': changedNodes };
}

//Removes the given players from the grid and then returns them and the changed
//grid spots
function performGameEnd(endedPlayers, gameObj) {
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

//Return the new location of the snake head, if it moved in
//the given direction
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

//Generate food and add it to the grid
function generateFood(gameObj) {
  let grid = gameObj.grid;
  let foodLoc = randomNum((10000 - gameObj.occupiedSpots), 1);
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

//Generate the random snake the players have to match to win
function generateWinSnake() {
  let snakeLen = randomNum(20, 15);
  let snakeParts = [];
  let dirs = [];
  let finalWinSnake = [];
  let tempSnakeLen = snakeLen;
  while (tempSnakeLen > 0) {
    let maxPartLen = Math.min(7, tempSnakeLen);
    let curPart = 0;
    if (tempSnakeLen <= 3) {
      curPart = tempSnakeLen;
    } else {
      curPart = randomNum(maxPartLen, 3);
    }
    snakeParts.push(curPart);
    tempSnakeLen = tempSnakeLen - curPart;
  }

  let initDir = getDirFromNum('none', randomNum(3, 0));
  dirs.push(initDir);
  for (let i = 0; i < snakeParts.length; ++i) {
    let curNum = randomNum(2, 0);
    let curDir = getDirFromNum(dirs[dirs.length - 1], curNum);
    dirs.push(curDir);
  }

  finalWinSnake.push({ 'x': 0, 'y': 0 });
  for (let i = 0; i < snakeParts.length; ++i) {
    let curPart = snakeParts[i];
    let curDir = dirs[i];
    for (let j = 0; j < curPart; ++j) {
      let lastPart = finalWinSnake[finalWinSnake.length - 1];
      let curPart = { 'x': lastPart.x, 'y': lastPart.y };
      if (curDir === 'up') {
        curPart.y = curPart.y - 1;
      } else if (curDir === 'right') {
        curPart.x = curPart.x + 1;
      } else if (curDir === 'down') {
        curPart.y = curPart.y + 1;
      } else {
        curPart.x = curPart.x - 1;
      }
      finalWinSnake.push(curPart);
    }
  }
  return finalWinSnake;
}

//Return a direction corresponding to the given num,
//and not returning the prevDir
function getDirFromNum(prevDir, num) {
  if (prevDir === 'none') {
    if (num === 0) {
      return 'up';
    } else if (num === 1) {
      return 'right';
    } else if (num === 2) {
      return 'down';
    } else {
      return 'left';
    }
  } else if (prevDir === 'up') {
    if (num === 0) {
      return 'up';
    } else if (num === 1) {
      return 'right';
    } else {
      return 'left';
    }
  } else if (prevDir === 'right') {
    if (num === 0) {
      return 'up';
    } else if (num === 1) {
      return 'right';
    } else {
      return 'down';
    }
  } else if (prevDir === 'down') {
    if (num === 0) {
      return 'right';
    } else if (num === 1) {
      return 'down';
    } else {
      return 'left';
    }
  } else if (prevDir === 'left') {
    if (num === 0) {
      return 'up';
    } else if (num === 1) {
      return 'down';
    } else {
      return 'left';
    }
  }
}

//Returns whether the snake matches the winSnake
function checkSnakeShapes(winSnake, playerSnake) {
  var offsetX = playerSnake[0].x;
  var offsetY = playerSnake[0].y;
  for (let i = 0; i < winSnake.length; ++i) {
    let winPart = winSnake[i];
    let playerPart = playerSnake[i];
    if ((winPart.x !== (playerPart.x - offsetX)) ||
      (winPart.y !== (playerPart.y - offsetY))) {
      return false;
    }
  }
  return true;
}

//Generate a random number between max and min
//taken from https://stackoverflow.com/a/7228322
function randomNum(max, min) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

//Check whether 2 directions are opposite
function checkDir(mainPlayer, secondPlayer) {
  if (mainPlayer.direction === 'up' && secondPlayer.direction === 'down') {
    return true;
  }

  if (mainPlayer.direction === 'down' && secondPlayer.direction === 'up') {
    return true;
  }

  if (mainPlayer.direction === 'right' && secondPlayer.direction === 'left') {
    return true;
  }

  if (mainPlayer.direction === 'left' && secondPlayer.direction === 'right') {
    return true;
  }

  return false;
}