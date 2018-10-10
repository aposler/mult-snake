window.addEventListener('load', mainFunc);
let delay = 25;
let pause = false;
let grid = false;
let moveDir = 'up';
let id = -1;
let initiated = false;
let blockSize = -1;
let offset = -1;
let connected = false;
let socket = null;
let winLength = -1;
//Once the page is loaded, mainFunc is run
function mainFunc() {
    let snakeCanvas = document.getElementById('snakeCanvas');
    let usernameBox = document.getElementById('username');
    if (!snakeCanvas || !usernameBox) {
        return;
    }
    if (initiated) {
        return;
    }
    initiated = true;
    initGrid(snakeCanvas);
    document.addEventListener('keydown', function (event) {
        switch (event.keyCode) {
            case 65: // A
                moveDir = 'left';
                break;
            case 87: // W
                moveDir = 'up';
                break;
            case 68: // D
                moveDir = 'right';
                break;
            case 83: // S
                moveDir = 'down';
                break;
        }
        if (socket) {
            socket.emit('movement', moveDir);
        }
    });

    usernameBox.onkeypress = function (event) {
        if (!event) {
            event = window.event;
        }
        var keyPressed = event.keyPressed || event.which;
        if (keyPressed === 13) {
            connectToServer();
        }
    }

    let connectClick = document.getElementById("connect");
    connectClick.onclick = function (event) {
        connectToServer();
    }
}

//Initiate connection to server, so long as there is a username to send
function connectToServer() {
    let username = document.getElementById('username');
    if (connected) {
        return;
    }
    if (username.value === "") {
        alert("Please Enter a Name");
        return;
    }
    connected = true;
    username.focus();
    username.blur();
    socket = io();
    socket.emit('connect');
    socket.on('connected', function () {
        onConnectFunc();
        socket.emit('username', username.value);
    });
}

//Runs once the connection is made
function onConnectFunc() {
    let snakeCanvas = document.getElementById('snakeCanvas');
    let usernameBox = document.getElementById('username');
    //Init the canvases and playerRanks with the init data 
    socket.on('initState', function (data) {
        grid = data.grid;
        id = data.id;
        winLength = data.winSnake.length;
        reInitGrid();
        drawWinSnake(data.winSnake);
        data.playerVals.sort(function (a, b) {
            if (a.score > b.score) {
                return -1;
            } else if (b.score > a.score) {
                return 1;
            } else {
                return 0;
            }
        });
        listPlayers(data.playerVals);
    });

    //Updates everything with the new vals
    socket.on('update', function (data) {
        grid = data.grid;
        reInitGrid();
        data.playerVals.sort(function (a, b) {
            if (a.score > b.score) {
                return -1;
            } else if (b.score > a.score) {
                return 1;
            } else {
                return 0;
            }
        });
        listPlayers(data.playerVals);
    });

    //Displays a message saying you lost
    socket.on('gameEnd', function (data) {
        let ctx = snakeCanvas.getContext("2d");
        ctx.font = "60px Arial";
        ctx.lineWidth = 3;
        ctx.textAlign = "center";
        ctx.fillStyle = "red"
        ctx.strokeStyle = "black";
        ctx.fillText("You Lost!", snakeCanvas.width / 2, snakeCanvas.height / 2);
        ctx.strokeText("You Lost!", snakeCanvas.width / 2, snakeCanvas.height / 2);
        connected = false;
    });

    //Displays a message saying the game is over and who won. If you won, 
    //displays it in green. It is red otherwise
    socket.on('gameWon', function (data) {
        let ctx = snakeCanvas.getContext("2d");
        if (data.id === id) {
            ctx.fillStyle = "green"
            ctx.strokeStyle = "black";
        } else {
            ctx.fillStyle = "red"
            ctx.strokeStyle = "black";
        }
        ctx.font = "60px Arial";
        ctx.lineWidth = 3;
        ctx.textAlign = "center";
        ctx.fillText("Player " + data.name + " won!", snakeCanvas.width / 2, snakeCanvas.height / 2);
        ctx.strokeText("Player " + data.name + " won!", snakeCanvas.width / 2, snakeCanvas.height / 2);
        connected = false;
    });
}

//Goes through the grid and redraws every block the the correct way for the given grid. If the spot
//is 0 draw white, 20 draw orange, your id draw green, and others draw black
function reInitGrid() {
    let dimensions = 100;
    let snakeCanvas = document.getElementById('snakeCanvas');
    let ctx = snakeCanvas.getContext("2d");
    ctx.lineWidth = 1;
    for (let i = 0; i < dimensions; i++) {
        for (let j = 0; j < dimensions; j++) {
            let curVal = grid[i][j];
            if (curVal === id) {
                ctx.fillStyle = "green";
                ctx.strokeStyle = "blue";
            } else if (curVal === 0) {
                ctx.fillStyle = "white";
                ctx.strokeStyle = "blue";
            } else if (curVal === 20) {
                ctx.fillStyle = "orange";
                ctx.strokeStyle = "blue";
            } else {
                ctx.fillStyle = "black";
                ctx.strokeStyle = "blue";
            }
            ctx.fillRect((j * blockSize) + offSet, (i * blockSize) + offSet, blockSize, blockSize);
            ctx.strokeRect((j * blockSize) + offSet, (i * blockSize) + offSet, blockSize, blockSize);
        }
    }
}

//Draw the initial grid
function initGrid(canvas) {
    let dimensions = 100;
    let width = 1000;
    let height = 1000;
    offSet = Math.floor((width % dimensions) / 2);
    blockSize = Math.floor(width / dimensions);
    canvas.width = width;
    canvas.height = height;
    let ctx = canvas.getContext("2d");
    ctx.lineWidth = 1;
    let offSetFull = Math.floor(ctx.canvas.width % dimensions);
    let gridEnd = (ctx.canvas.width - (offSetFull - offSet));
    ctx.fillStyle = "white";
    ctx.strokeStyle = "blue";
    for (let i = 0 + offSet; i < gridEnd; i += blockSize) {
        for (let j = 0 + offSet; j < gridEnd; j += blockSize) {
            ctx.fillRect(i, j, blockSize, blockSize);
            ctx.strokeRect(i, j, blockSize, blockSize);
        }
    }
}

//Draw on the winSnake grid with the snake needed to win. The head
//is drawn in a different color
function drawWinSnake(winSnake) {
    let canvas = document.getElementById("winCanvas");
    let minX = 100;
    let minY = 100;
    let maxX = -100;
    let maxY = -100;
    for (let i = 0; i < winSnake.length; ++i) {
        let curNode = winSnake[i];
        if (curNode.x < minX) {
            minX = curNode.x;
        }
        if (curNode.x > maxX) {
            maxX = curNode.x;
        }
        if (curNode.y < minY) {
            minY = curNode.y;
        }
        if (curNode.y > maxY) {
            maxY = curNode.y;
        }
    }

    let dimensions = -1;
    if (maxX - minX > maxY - minY) {
        dimensions = maxX - minX;
    } else {
        dimensions = maxY - minY;
    }
    ++dimensions;

    canvas.width = dimensions * 10;
    canvas.height = dimensions * 10;
    let blockSize = 10;
    let ctx = canvas.getContext("2d");
    ctx.lineWidth = 1;
    let tempGrid = [];
    for (var j = 0; j < dimensions; ++j) {
        tempGrid.push([]);
        tempGrid[j].length = dimensions;
        tempGrid[j].fill(0);
    }

    for (let i = 0; i < winSnake.length; ++i) {
        let curNode = winSnake[i];
        tempGrid[curNode.y - minY][curNode.x - minX] = i + 1;
    }

    for (let i = 0; i < dimensions; ++i) {
        for (let j = 0; j < dimensions; ++j) {
            if (tempGrid[j][i] === 0) {
                ctx.fillStyle = "white";
                ctx.strokeStyle = "blue";
            } else if (tempGrid[j][i] === 1) {
                ctx.fillStyle = "darkslategrey";
                ctx.strokeStyle = "blue";
            } else {
                ctx.fillStyle = "darkgrey";
                ctx.strokeStyle = "blue";
            }
            ctx.fillRect(i * blockSize, j * blockSize, blockSize, blockSize);
            ctx.strokeRect(i * blockSize, j * blockSize, blockSize, blockSize);
        }
    }
}

//Updates the playerRanks with the given player list
function listPlayers(playerList) {
    let newBody = document.createElement('tbody');
    let winTr = document.createElement('tr');
    let winTd = document.createElement('td');
    winTd.innerHTML = "Winning Snake Length: " + winLength;
    winTr.appendChild(winTd);
    newBody.appendChild(winTr);
    for (let i = 0; i < playerList.length; ++i) {
        let curPlayer = playerList[i];
        let newTr = document.createElement('tr');
        let newTd = document.createElement('td');
        if (curPlayer.id === id) {
            newTd.innerHTML = curPlayer.name + " (you): " + curPlayer.score;
        } else {
            newTd.innerHTML = curPlayer.name + ": " + curPlayer.score;
        }
        newTr.appendChild(newTd);
        newBody.appendChild(newTr);
    }
    let oldBody = document.getElementsByTagName("tbody")[0];
    oldBody.parentNode.replaceChild(newBody, oldBody);
}
