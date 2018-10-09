window.addEventListener('load', mainFunc);
let delay = 25;
let pause = false;
let grid = false;
let moveDir = 'up';
let id = -1;
let initiated = false;
let blockSize = -1;
let offset = -1;
//Once the page is loaded, mainFunc is run. mainFunc just adds a 
function mainFunc() {
    let snakeCanvas = document.getElementById('snakeCanvas');
    if (!snakeCanvas) {
        return;
    }
    if (initiated) {
        return;
    }
    initiated = true;
    initGrid(snakeCanvas);
    let socket = io();
    socket.on('initState', function (data) {
        console.log(data);
        grid = data.grid;
        id = data.id;
        reInitGrid();
    });


    socket.on('update', function (data) {
        console.log(data.changes);
        grid = data.grid;
        console.log(grid);
        reInitGrid();
    });

    socket.emit('connect');

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
        console.log(moveDir);
        //debugger;
        socket.emit('movement', moveDir);
    });
}

//Goes through the grid and redraws every block the way it was, unless it was part of the solved path or set
//to 2 by the pathing algorith. Solved path blocks are redrawn to empty, and all spots set to 2 are set to 0.
function reInitGrid() {
    let dimensions = 100;
    let snakeCanvas = document.getElementById('snakeCanvas');
    let ctx = snakeCanvas.getContext("2d");
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

function initGrid(canvas) {
    let dimensions = 100;
    offSet = Math.floor((canvas.clientWidth % dimensions) / 2);
    blockSize = Math.floor(canvas.clientWidth / dimensions);
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
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

