var requrl = window.location.protocol + '//' + window.location.host + '/';
var loadReady = false;
var socket = io.connect(requrl);

var uploadDelayTime = 10;

var undoStep = -1;
//$('#undo_button').css('display', 'none');

$(document).ready(function () {
    loadReady = true;
});
$("#loading").fadeOut();

/*
* Drawer functions
*/
$('.zoomIn').click(function () {
    puzzle.zoom(.1);
});

$('.zoomOut').click(function () {
    puzzle.zoom(-.1);
});

// $('.help').mousedown(function () {
//     puzzle.showLastResult();
// });

$('.restart').click(function () {
    // document.execCommand('Refresh');
    window.location.reload();
    // var puzzle = new JigsawPuzzle(config);
});


var hintedLinksNum = undefined;
var totalHintsNum = 0;
var correctHintsNum = 0;

// document.querySelector('#show_steps').addEventListener('click', function () {
//     $('#steps').fadeToggle('slow');
// });
// document.querySelector('#show_timer').addEventListener('click', function () {
//     $('#timer').fadeToggle('slow');
// });

/*
* Jigsaw functions
*/
Array.prototype.remove = function (start, end) {
    this.splice(start, end);
    return this;
}

view.currentScroll = new Point(0, 0);
var scrollVector = new Point(0, 0);
var scrollMargin = 32;

$('#puzzle-image').attr('src', imgSrc);

var imgWidth = $('.puzzle-image').css('width').replace('px', '');
var imgHeight = $('.puzzle-image').css('height').replace('px', '');

if (level == 3) {
    tileWidth = 32;
}
if (level == 4) {
    imgWidth = 1024;
    imgHeight = 1024;
}

var config = ({
    zoomScaleOnDrag: 1.25,
    imgName: 'puzzle-image',
    tileShape: 'straight', // curved or straight or voronoi
    tileWidth: tileWidth,
    showHints: true,
    shadowWidth: 120,
    dragMode: 'tile-First',// tile-First or group-First
    allowOverlap: false //whether allows overLap
});

var directions = [
    new Point(0, -1),
    new Point(1, 0),
    new Point(0, 1),
    new Point(-1, 0)
];

var oppositiveEdges = [2, 3, 0, 1]; // 0(up)<->2(bottom), 1(right)<->3(left) 
/**
 * Start building the puzzle
 */
if (roundShape == 'square') {
    config.tileShape = 'straight';
}
else {
    config.tileShape = 'curved';
}

if (level == 1) {
    config.level = 1;
    //config others here
} else if (level == 2) {
    config.level = 2;
    //config others here    
}

var puzzle = new JigsawPuzzle(config);
/Android|webOS|iPhone|iPod|BlackBerry/i.test(navigator.userAgent) ? puzzle.zoom(-0.5) : puzzle.zoom(-0.1);

var time = 0;
var t;
//var startTime = (new Date()).getTime(); //compute from when the user ready
var startTime = serverStartTime; //compute from when the round start at server-side
function timedCount() {
    time = Math.floor(((new Date()).getTime() - startTime) / 1000);
    var hours = Math.floor(time / 3600);
    var minutes = Math.floor((time - hours * 3600) / 60);
    var seconds = time - hours * 3600 - minutes * 60;
    if (hours >= 0 && hours <= 9) hours = '0' + hours;
    if (minutes >= 0 && minutes <= 9) minutes = '0' + minutes;
    if (seconds >= 0 && seconds <= 9) seconds = '0' + seconds;
    document.getElementById('timer').innerHTML = hours + ":" + minutes + ":" + seconds;
    t = setTimeout(timedCount, 1000);
}

if (puzzle)
    timedCount();

if (puzzle){
    socket.emit('getScore',{
        round_id: roundID,
        player_name: player_name,
    });
}
// $('#myselect').change(function () {
//     if (puzzle) {
//         if (this.value == "DragTileFirst") {
//             puzzle.dragMode = "tile-First";
//         }
//         else {
//             puzzle.dragMode = "group-First";
//         }
//     }
// });


var path;
var movePath = false;

$('.puzzle-image').css('margin', '-' + imgHeight / 2 + 'px 0 0 -' + imgWidth / 2 + 'px');

var downTime, alreadyDragged, dragTime, draggingGroup;
var mousedowned = false;
var timeoutFunction;
// function onMouseDown(event) {
//     mousedowned = true;
//     var tilesCount = puzzle.pickTile(event.point);
//     console.log("tilescount",tilesCount);
//     if (tilesCount > 0) {
//         timeoutFunction = setTimeout(puzzle.dragTileOrTiles, 500);
//     }
// }

function onMouseDown(event) {
    puzzle.pickTile(event.point);
    puzzle.dragOnlyTile();
    console.log("mouse down");
}

function onFrame(event) {
    // Each frame, rotate the path by 3 degrees:
    puzzle.animation();
}

// function onMouseUp(event) {
//     if (timeoutFunction) {
//         clearTimeout(timeoutFunction);
//     }
//     puzzle.releaseTile();
//     mousedowned = false;
// }

function onMouseUp(event) {
    puzzle.releaseTile();
    mousedowned = false;
}


function onMouseDrag(event) {
    var ca = document.getElementById("canvas");
    ca.getContext("2d").clearRect(0, 0, ca.width, ca.height);
    mousedowned = true;
    // if (timeoutFunction) {
    //     clearTimeout(timeoutFunction);
    // }
    puzzle.dragTile(event.delta);
}

$(window).bind('mousewheel', function (e) {
    if (e.originalEvent.wheelDelta > 0) {
        puzzle.zoom(.1);
    }
    else {
        puzzle.zoom(-.1);
    }
});

function onKeyDown(event) {
    if (event.event.ctrlKey && event.key == "z") {
        // undo a step
        if (puzzle.steps != undoStep) {
            puzzle.undoNextStep();
        }
    }
}

function onKeyUp(event) {
    console.log(event.key);
    switch (event.key) {
        case 'z':
            puzzle.zoom(.1);
            break;
        case 'x':
            puzzle.zoom(-.1);
            break;
        case 'left':
            puzzle.leftMove();
            break;
        case 'up':
            puzzle.upMove();
            break;
        case 'down':
            puzzle.downMove();
            break;
        case 'right':
            puzzle.rightMove();
            break;
    }
}

function getOriginImage(config) {
    var raster = undefined;
    if (config.level == 4) {
        var path = new Path.Rectangle(new Point(0, 0), new Size(config.imgWidth, config.imgHeight));
        path.fillColor = config.imgName;
        raster = path.rasterize();
        path.remove();
    }
    else {
        raster = new Raster(config.imgName);
    }
    return raster;
}

function JigsawPuzzle(config) {
    var instance = this; // the current object(which calls the function)
    socket.on('someoneSolved', function (data) {
        if (data.round_id == roundID) {
            $.amaran({
                'title': 'someoneSolved',
                'message': data.player_name + ' has solved the puzzle!',
                'inEffect': 'slideRight',
                'cssanimationOut': 'zoomOutUp',
                'position': "top right",
                'delay': 3000,
                'closeOnClick': true,
                'closeButton': true
            });
        }
    });

    this.forceLeaving = false;
    this.forceLeave = function (text) {
        instance.forceLeaving = true;
        $('#cancel-button').attr('disabled', "true");

        $('#quitLabel').text(text);
        $('#ensure_quit_dialog').modal({
            keyboard: false,
            backdrop: false
        });
    }
    ////
    socket.on('forceLeave', function (data) {
        if (data.round_id == roundID) {
            instance.forceLeave('Someone Have Finished the Puzzle. Please Quit.');
        }
    });

    socket.on('gameSaved', function (data) {
        if (data.success == true && data.round_id == roundID && data.player_name == player_name) {
            console.log("Saved.");
        } else {
            console.log(data.err);
        }
    });

    socket.on('roundChanged', function (data) {
        if (data.username == player_name && data.round_id == roundID) {
            $('.rating-body').css('display', 'inline');
            $('#apply-button').removeAttr('disabled');
            $('#submit-button').removeAttr('disabled');
            $('#cancel-button').removeAttr('disabled');
            if (data.action == "quit") {
                if (players_num == 1) {
                    window.location = '/home';
                }
                else {
                    window.location = '/award/' + roundID;
                }
            }
        }
    });

    socket.on('addScore',function (data) {
        if(data.round_id == roundID && data.player_name == player_name){
            console.log("front add");
            instance.score = data.score;
            document.getElementById("score").innerHTML = instance.score;
        }
    });
    socket.on('already_exist',function (data) {
        console.log("hhhhhhhhyoulaaaa");
    });

    socket.on('hintReturn',function (data) {
        if(data.round_id == roundID && data.player_name == player_name){
            if(!data.returnArray){return;}
            for(var j=0; j<data.returnSize; j++)
                for(var i=0; i<data.returnSize; i++)
                {
                    var index = data.returnArray[j*data.returnSize+i];
                    var tile = instance.tiles[index];
                    var position = instance.playerAreaPosition + new Point((i + 0.5) * instance.tileWidth, (j + 0.5) * instance.tileWidth);
                    tile.position = position;
                    tile.cellPosition = new Point(i, j);
                    tile.area = 1;
                    instance.playerAreaArray[j*instance.tilesPerRow+i]=tile;
                }
            for(var j=0; j<instance.tilesPerColumn; j++)
                for(var i=0; i<instance.tilesPerRow; i++)
                {
                    var tile = instance.candidateAreaArray[j*instance.tilesPerRow+i];
                    if(tile.area == 1){
                        instance.candidateAreaArray[j*instance.tilesPerRow+i] = null;
                    }
                }
        }
    });
    this.tileShape = config.tileShape;
    this.level = config.level;

    this.currentZoom = 1;
    this.zoomScaleOnDrag = config.zoomScaleOnDrag;
    this.imgName = config.imgName;
    this.shadowWidth = config.shadowWidth;
    this.tileWidth = config.tileWidth;
    this.originImage = new Raster(config.imgName);
    this.imgSize = this.originImage.size;
    this.imgWidth = this.imgSize.width;
    this.imgHeight = this.imgSize.height;
    //console.log("imgsize",this.imgSize);
    //this.imgWidth = imageWidth;
    //console.log("imgwidth,imgheight,tilesperrow,tilepercol,tilewidth",this.imgWidth,this.imgHeight,tilesPerRow,tilesPerColumn,tileWidth);
    //this.imgHeight = imageHeight;
    this.tilesPerRow = parseInt(tilesPerRow);
    this.tilesPerColumn = parseInt(tilesPerColumn);
    //this.puzzleImage = this.originImage.getSubRaster(new Rectangle(0, 0, this.tilesPerRow * this.tileWidth, this.tilesPerColumn * this.tileWidth));
    this.puzzleImage = this.originImage;
    //this.puzzleImage = new Raster(this.originImage);
    //this.puzzleImage.size *= Math.max((this.tileWidth / 2) / this.puzzleImage.size.width, (this.tileWidth / 2) / this.puzzleImage.size.height) + 1;
    //console.log("puzzleimagesize",this.puzzleImage.size);
    //this.puzzleImage.size = this.originImage.size;
    this.puzzleImage.position = view.center;
    this.originImage.visible = false;
    this.puzzleImage.visible = false;

    this.centerPositon = new Point(660, 330);
    this.candidateAreaPosition = this.centerPositon - new Point(this.tilesPerRow * this.tileWidth + 100, this.tilesPerColumn * this.tileWidth / 2);
    this.playerAreaPosition = this.centerPositon - new Point(-100, this.tilesPerColumn * this.tileWidth / 2);
    this.candidateAreaArray = new Array();
    this.playerAreaArray = new Array();

    this.dragMode = config.dragMode;

    this.showHints = config.showHints;

    this.tilesNum = this.tilesPerRow * this.tilesPerColumn;
    // this.tileInformation = [[0,3,4,5],[7,9,8,0],[8,5,5,9],[0,5,0,1],
    //     [4,7,1,8],[1,1,8,3],[0,0,7,9],[8,1,0,3],
    //     [7,8,9,5],[9,0,9,8],[8,6,7,5],[1,9,9,7],
    //     [3,5,7,1],[9,3,8,0],[2,1,1,3],[1,3,2,0]];
    this.tileInformation = getTileInfo(imgSrc);

    if (this.tileShape == "voronoi") {
        this.tileMarginWidth = this.tileWidth * 0.5;
    }
    else {
        //this.tileMarginWidth = this.tileWidth * ((100 / this.tileWidth - 1) / 2);
        //this.tileMarginWidth = this.tileWidth/5;
        this.tileMarginWidth = 0;
    }
    this.selectedTile = undefined;
    this.selectedGroup = undefined;

    this.saveShapeArray = shapeArray;
    this.saveTilePositions = undefined;
    this.saveHintedLinks = undefined;
    this.shapeArray = undefined;
    this.tiles = undefined;
    this.edgesKept = undefined;
    this.edgesDropped = undefined;
    this.groups = undefined; // a connected subgraph as a group
    this.sizes = undefined; // number of edges as the size
    this.askHelpTimeout = undefined; // time past since last action
    this.lastStepTime = 0;
    this.thisStepTime = 0;
    this.linksChangedCount = 0;

    this.dfsGraphLinksMap = new Array();
    this.subGraphData = new Array();
    this.removeLinksData = new Array();
    this.subGraphNodesCount = 0;

    this.hintsShowing = false;
    this.undoing = false;
    this.draging = false;

    this.shadowScale = 1.5;

    this.steps = 0;
    this.realSteps = 0;
    this.realStepsCounted = false;

    this.score = 0;

    this.gameStarted = false;

    this.allowOverlap = config.allowOverlap;

    this.gameFinished = false;

    this.maxSubGraphSize = 0;

    this.unsureHintsColor = ["red"];
    this.colorBorderWidth = 10;

    this.hintedTilesMap = new Array();

    this.hintAroundTilesMap = new Array();

    this.getHintsArray = new Array();

    this.hintsLog = {};

    this.subGraphDataQueue = new Array();
    this.subGraphDataQueue_FIFO = true;

    this.conflictGroupHasBeenMoveAway = false;

    $.amaran({
        'title': 'startRound',
        'message': 'Round ' + roundID + ': ' + this.tilesPerRow + ' * ' + this.tilesPerColumn,
        'inEffect': 'slideRight',
        'cssanimationOut': 'zoomOutUp',
        'position': "top right",
        'delay': 2000,
        'closeOnClick': true,
        'closeButton': true
    });
    console.log('Round ' + roundID + ': ' + this.tilesPerRow + ' * ' + this.tilesPerColumn);

    loadGame();

    function createAndPlaceTiles(needIntro) {
        if (instance.tileShape == "voronoi") {
            instance.tiles = createVoronoiTiles(instance.tilesPerRow, instance.tilesPerColumn);
        }
        else {
            instance.tiles = createTiles(instance.tilesPerRow, instance.tilesPerColumn);
        }
        placeTiles(instance.tilesPerRow, instance.tilesPerColumn);
        instance.edgesKept = new Array();
        instance.edgesDropped = new Array();
        instance.groups = new Array();
        instance.sizes = new Array();

        // for (var i = 0; i < instance.tiles.length; i++) {
        //     var tile = instance.tiles[i];
        //     refreshAroundTiles(tile, false);
        //     tile.aroundTilesChanged = false;
        //     tile.preStep = instance.step - 2;
        //     tile.preCellPosition = tile.cellPosition;
        //     if (!tile.subGraphSize) {
        //         tile.subGraphSize = 0;
        //         tile.nodesCount = 1;
        //     }
        //     instance.groups[i] = i;
        //     instance.sizes[i] = 0;
        //     tile.wantToMoveAway = -1;
        // }
        //
        // if (instance.saveHintedLinks) {
        //     for (var i = 0; i < instance.saveHintedLinks.length; i++) {
        //         var tile = instance.tiles[i];
        //         tile.hintedLinks = instance.saveHintedLinks[i];
        //     }
        // }
        //
        // for (var i = 0; i < instance.tiles.length; i++) {
        //     var tile = instance.tiles[i];
        //     computeSubGraph(tile);
        // }
        // computeGraphData();
        //
        // if (!instance.saveTilePositions) {
        //     saveGame();
        // }
        // else {
        //     if (!instance.gameFinished) {
        //         var errors = checkTiles();
        //         if (errors == 0) {
        //             finishGame();
        //         }
        //     }
        // }
        //
        // normalizeTiles();
        // instance.focusToCenter();

        instance.gameStarted = true;

        // if (needIntro) {
        //     // $("#step1").click();
        //     introJs().setOption("overlayOpacity", 0).setOptions({
        //         steps: [
        //             {
        //                 element: '#step2',
        //                 intro: "Zoom in!"
        //             },
        //             {
        //                 element: '#step3',
        //                 intro: "Zoom out!"
        //             },
        //             {
        //                 element: '#step4',
        //                 intro: "Restart the game!"
        //             },
        //             {
        //                 element: '#step5',
        //                 intro: "Return to the center!"
        //             },
        //             {
        //                 element: '#quit',
        //                 intro: "Quit the game!"
        //             },
        //             // {
        //             //     element: '#myselect',
        //             //     intro: "Change the drag mode here!"
        //             // },
        //             {
        //                 element: '#steps_chip',
        //                 intro: "Show/Hide the step counter!"
        //             },
        //             {
        //                 element: '#timer_chip',
        //                 intro: "Show/Hide the time counter!"
        //             },
        //             // {
        //             //     intro: "Drag mode 'dragTileFirst': short press to drag a tile and long press to drag a group of tiles, vice versa."
        //             // },
        //             {
        //                 intro: "Now Let's Begin!"
        //             }
        //         ],
        //         scrollToElement: false
        //     }).start();
        // }
    }

    function refreshAroundTiles(tile, beHinted) {
        var tileIndex = getTileIndex(tile);

        var cellPosition = tile.cellPosition;

        var topTile = getTileAtCellPosition(cellPosition + new Point(0, -1));
        var rightTile = getTileAtCellPosition(cellPosition + new Point(1, 0));
        var bottomTile = getTileAtCellPosition(cellPosition + new Point(0, 1));
        var leftTile = getTileAtCellPosition(cellPosition + new Point(-1, 0));

        var aroundTiles = new Array(getTileIndex(topTile), getTileIndex(rightTile),
            getTileIndex(bottomTile), getTileIndex(leftTile));

        var aroundTilesChanged = false;

        if (!tile.aroundTiles) {
            tile.aroundTiles = new Array(-1, -1, -1, -1);
        }

        for (var i = 0; i < aroundTiles.length; i++) {
            if (!beHinted) {
                if (aroundTiles[i] == -1 && tile.aroundTiles[i] != -1) { // add conflict record to both tile connected before
                    tile.conflictTiles[tile.aroundTiles[i]] = true;
                    var neighborTile = instance.tiles[tile.aroundTiles[i]];
                    neighborTile.conflictTiles[tileIndex] = true;
                }

                if (tile.aroundTiles[i] == -1 && aroundTiles[i] != -1) { // remove conflict record to both tile
                    tile.conflictTiles[aroundTiles[i]] = false;
                    var neighborTile = instance.tiles[aroundTiles[i]];
                    neighborTile.conflictTiles[tileIndex] = false;
                }
            }

            if (tile.aroundTiles[i] != aroundTiles[i]) {
                aroundTilesChanged = true;

                if (beHinted) {
                    tile.hintedLinks[i] = aroundTiles[i];
                }
                else {
                    instance.linksChangedCount += 1;
                    if (tile.hintedLinks[i] >= 0) {
                        tile.hintedLinks[i] = Math.floor(tile.hintedLinks[i]) + 0.5;
                    }
                }
            }
        }
        if (aroundTilesChanged) {
            if (instance.gameStarted && !instance.realStepsCounted && !beHinted) {
                instance.realSteps += 1;
                document.getElementById("steps").innerHTML = instance.realSteps;

                instance.lastStepTime = instance.thisStepTime;
                instance.thisStepTime = time;
                clearTimeout(instance.askHelpTimeout);
                var delta = Number(instance.thisStepTime - instance.lastStepTime);
                if (delta >= 2 && instance.linksChangedCount >= 0) {
                    console.log("Delta", delta);
                    instance.linksChangedCount = 0;
                    instance.askHelpTimeout = setTimeout(askHelp, 5000 * delta);
                }

                instance.realStepsCounted = true;
            }

            tile.oldAroundTiles = tile.aroundTiles;
            tile.aroundTiles = aroundTiles;
            tile.aroundTilesChanged = aroundTilesChanged;

            var sum = 0;
            var allLinksHinted = true;
            var allAroundByTiles = true;
            for (var i = 0; i < tile.aroundTiles.length; i++) {
                sum += tile.aroundTiles[i];
                if (tile.aroundTiles[i] < 0) {
                    allAroundByTiles = false;
                }
                if (tile.aroundTiles[i] >= 0 && tile.hintedLinks[i] != tile.aroundTiles[i]) {
                    allLinksHinted = false;
                }

                if (tile.aroundTiles[i] != tile.oldAroundTiles[i]) {
                    if (tile.oldAroundTiles[i] >= 0) {
                        var neighborTile = instance.tiles[tile.oldAroundTiles[i]];
                        refreshAroundTiles(neighborTile, beHinted);
                    }
                    if (tile.aroundTiles[i] >= 0) {
                        var neighborTile = instance.tiles[tile.aroundTiles[i]];
                        refreshAroundTiles(neighborTile, beHinted);
                    }
                }
            }
            if (sum == -4) {
                tile.noAroundTiles = true;
                tile.allLinksHinted = false;
            }
            else {
                tile.noAroundTiles = false;
                tile.allLinksHinted = allLinksHinted;
            }
            tile.allAroundByTiles = allAroundByTiles;
        }

        if (!tile.oldAroundTiles) {
            tile.oldAroundTiles = new Array(-1, -1, -1, -1);
        }
    }

    this.focusToCenter = function () {
        view.scrollBy(instance.centerPoint - view.center / 1.25);
    }

    this.calcHintedTile = function () {
        hintedLinksNum = {
            totalLinks: 0,
            normalLinks: 0,
            hintedLinks: 0,
            correctLinks: 0
        };
        if (!instance.tiles) {
            return;
        }
        for (var i = 0; i < instance.tiles.length; i++) {
            var tile = instance.tiles[i];
            for (var j = 0; j < tile.hintedLinks.length; j++) {
                if (tile.aroundTiles[j] >= 0) {
                    var correctIndex = i + directions[j].x + directions[j].y * instance.tilesPerRow;
                    if (tile.aroundTiles[j] == correctIndex) {
                        hintedLinksNum.correctLinks += 1;
                    }
                    if (tile.hintedLinks[j] >= 0 && Math.floor(tile.hintedLinks[j]) == tile.aroundTiles[j]) {
                        hintedLinksNum.hintedLinks += 1;
                    }
                    else {
                        hintedLinksNum.normalLinks += 1;
                    }
                    hintedLinksNum.totalLinks += 1;
                }
            }
        }
    }

    function finishGame() {
        instance.gameFinished = true;

        clearTimeout(t);

        //instance.calcHintedTile();

        // for (var i = 0; i < instance.tiles.length; i++) {
        //     var tile = instance.tiles[i];
        //     computeSubGraph(tile);
        // }
        // computeGraphData();

        if (!instance.forceLeaving) {
            $('#finish_dialog').modal({
                keyboard: false,
                backdrop: false
            });
        }

        /**
         * Once one person solves the puzzle, the round is over
         * Send a msg to the server and the server broadcast it to all players
         **/
        steps = Number(document.getElementById("steps").innerHTML);

        socket.emit('iSolved', {
            round_id: roundID,
            player_name: player_name,
            steps: steps,
            startTime: startTime,
            totalLinks: hintedLinksNum.totalLinks,
            hintedLinks: hintedLinksNum.hintedLinks,
            correctLinks: hintedLinksNum.correctLinks,
            totalHintsNum: totalHintsNum,
            correctHintsNum: correctHintsNum
        });
    }

    function placeTiles(xTileCount, yTileCount) {
        var tiles = instance.tiles;
        var tileIndexes = instance.tileIndexes;
        if (instance.saveTilePositions) {
            for (var i = 0; i < instance.saveTilePositions.length; i++) {
                var tilePos = instance.saveTilePositions[i];
                var tile = instance.tiles[tilePos.index];
                placeTile(tile, new Point(tilePos.x, tilePos.y));
                tile.subGraphSize = tilePos.subGraphSize;
                tile.nodesCount = tilePos.nodesCount;
                tile.moved = false; // if one tile just clicked or actually moved(if moved, opacity=1)
                tile.aroundTilesChanged = false;
                tile.noAroundTiles = true;
                tile.aroundTiles = new Array(-1, -1, -1, -1);
                tile.hintedLinks = new Array(-1, -1, -1, -1);
                tile.conflictTiles = new Array();
                tile.positionMoved = false;
            }
            return;
        }
        // randomly select tiles and place them one by one 
        // for (var y = 0; y < yTileCount; y++) {
        //     for (var x = 0; x < xTileCount; x++) {
        //
        //         var index1 = Math.floor(Math.random() * tileIndexes.length);
        //         var index2 = tileIndexes[index1];
        //         var tile = tiles[index2];
        //         tileIndexes.remove(index1, 1);
        //
        //         var position = view.center -
        //             new Point(instance.tileWidth, instance.tileWidth / 2) +
        //             new Point(instance.tileWidth * (x * 2 + ((y % 2))), instance.tileWidth * (y * 1)) -
        //             new Point(instance.puzzleImage.size.width, instance.puzzleImage.size.height / 2);
        //
        //         var cellPosition = new Point(
        //             Math.round(position.x / instance.tileWidth),//returns int closest to arg
        //             Math.round(position.y / instance.tileWidth));
        //
        //         tile.position = cellPosition * instance.tileWidth; // round position(actual (x,y) in the canvas)
        //         tile.cellPosition = cellPosition; // cell position(in which grid the tile is)
        //         tile.relativePosition = new Point(0, 0);
        //         tile.moved = false; // if one tile just clicked or actually moved(if moved, opacity=1)
        //         tile.aroundTilesChanged = false;
        //         tile.noAroundTiles = true;
        //         tile.aroundTiles = new Array(-1, -1, -1, -1);
        //         tile.hintedLinks = new Array(-1, -1, -1, -1);
        //         tile.conflictTiles = new Array();
        //         tile.positionMoved = false;
        //     }
        // }
        for (var y = 0; y < yTileCount; ++y) {
            for (var x = 0; x < xTileCount; ++x) {
                var tile = tiles[y * xTileCount + x];
                var position = instance.candidateAreaPosition + new Point((x + 0.5) * instance.tileWidth, (y + 0.5) * instance.tileWidth);
                tile.position = position;
                tile.cellPosition = new Point(x, y);
                tile.area = 0;
                instance.candidateAreaArray[y*xTileCount+x]=tile;
            }
        }
    }

    function createTiles(xTileCount, yTileCount) {
        var tiles = new Array();
        //console.log("WIDTH",instance.tileWidth);
        var tileRatio = instance.tileWidth / 100.0;
        if (instance.saveShapeArray) {
            instance.shapeArray = instance.saveShapeArray;
        }
        else {
            instance.shapeArray = getRandomShapes(xTileCount, yTileCount);
        }
        var tileIndexes = new Array();
        for (var y = 0; y < yTileCount; y++) {
            for (var x = 0; x < xTileCount; x++) {

                var shape = instance.shapeArray[y * xTileCount + x];

                var maskMap = getMask(tileRatio, shape.topTab, shape.rightTab, shape.bottomTab, shape.leftTab, instance.tileWidth);

                var mask = maskMap.mask;

                var topEdge = maskMap.topEdge;
                topEdge.strokeWidth = instance.colorBorderWidth;
                topEdge.visible = false;

                var rightEdge = maskMap.rightEdge;
                rightEdge.strokeWidth = instance.colorBorderWidth;
                rightEdge.visible = false;

                var bottomEdge = maskMap.bottomEdge;
                bottomEdge.strokeWidth = instance.colorBorderWidth;
                bottomEdge.visible = false;

                var leftEdge = maskMap.leftEdge;
                leftEdge.strokeWidth = instance.colorBorderWidth;
                leftEdge.visible = false;

                // var mask = new Path();
                // mask.add(new Point(0,0));
                // mask.add(new Point(0,instance.tileWidth));
                // mask.add(new Point(instance.tileWidth,0));
                // mask.add(new Point(instance.tileWidth,instance.tileWidth));
                // mask.closed = true;

                var offset = new Point(instance.tileWidth * x, instance.tileWidth * y);
                //offset += new Point(instance.tileWidth / 4, instance.tileWidth / 4);
                //console.log("fuck",instance.puzzleImage.size);
                var img = getTileRaster(
                    instance.puzzleImage,
                    new Size(instance.tileWidth, instance.tileWidth),
                    offset
                );
                //console.log(img);
                var border = mask.clone();
                border.strokeColor = 'grey'; //grey
                border.strokeWidth = (hasBorder == "true") ? 2 : 0;

                var colorBorder = mask.clone();
                colorBorder.strokeWidth = instance.colorBorderWidth;
                colorBorder.visible = false;

                // each tile is a group of
                var tile = new Group(mask, img, border);
                tile.clipped = true;
                tile = new Group(topEdge, rightEdge, bottomEdge, leftEdge, colorBorder, tile);
                tile.topEdge = topEdge;
                tile.rightEdge = rightEdge;
                tile.bottomEdge = bottomEdge;
                tile.leftEdge = leftEdge;
                tile.colorBorder = colorBorder;
                tile.differentColor = new Array();
                tile.colorDirection = new Array();

                tile.picking = false;
                tile.alreadyHinted = false;
                tile.opacity = 1;
                tile.pivot = new Point(instance.tileWidth / 2, instance.tileWidth / 2);

                tile.shape = shape;
                tile.imagePosition = new Point(x, y);

                // tile fixed index/unique id
                tile.findex = y * xTileCount + x;
                //console.log(tile.findex);
                tiles.push(tile);
                tile.name = "tile-" + tileIndexes.length;
                tileIndexes.push(tileIndexes.length);
            }
        }
        instance.tileIndexes = tileIndexes;
        return tiles;
    }

    function showUnsureHintColor(tileIndex, hintTilesIndexs, direction, colorIndex) {
        showColorBorder(tileIndex, direction, colorIndex, true);
        for (var i = 0; i < hintTilesIndexs.length; i++) {
            var reverseDirection = 4;
            if (direction % 2 == 0) {
                reverseDirection = 2 - direction;
            }
            else {
                reverseDirection = 4 - direction;
            }
            showColorBorder(hintTilesIndexs[i], reverseDirection, colorIndex, true);
        }
    }

    function getRandomShapes(width, height) {
        var shapeArray = new Array();

        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {

                var topTab = undefined;
                var rightTab = undefined;
                var bottomTab = undefined;
                var leftTab = undefined;

                if (y == 0) {
                    topTab = (hasEdge == "true") ? 0 : getRandomTabValue();
                }

                if (y == height - 1) {
                    bottomTab = (hasEdge == "true") ? 0 : getRandomTabValue();
                }

                if (x == 0) {
                    leftTab = (hasEdge == "true") ? 0 : getRandomTabValue();
                }

                if (x == width - 1) {
                    rightTab = (hasEdge == "true") ? 0 : getRandomTabValue();
                }

                shapeArray.push(
                    ({
                        topTab: topTab,
                        rightTab: rightTab,
                        bottomTab: bottomTab,
                        leftTab: leftTab
                    })
                );
            }
        }

        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {

                var shape = shapeArray[y * width + x];

                var shapeRight = (x < width - 1) ?
                    shapeArray[y * width + (x + 1)] :
                    undefined;

                var shapeBottom = (y < height - 1) ?
                    shapeArray[(y + 1) * width + x] :
                    undefined;

                shape.rightTab = (x < width - 1) ?
                    getRandomTabValue() :
                    shape.rightTab;

                if (shapeRight)
                    shapeRight.leftTab = -shape.rightTab;

                shape.bottomTab = (y < height - 1) ?
                    getRandomTabValue() :
                    shape.bottomTab;

                if (shapeBottom)
                    shapeBottom.topTab = -shape.bottomTab;
            }
        }
        return shapeArray;
    }

    function getRandomTabValue() {
        //math.floor() returns max int <= arg
        switch (instance.tileShape) {
            case 'straight': {
                return 0;
                break;
            }
            case 'curved': {
                return Math.pow(-1, Math.floor(Math.random() * 2));
                ;
                break;
            }
            default: {
                return 0;
            }
        }
    }

    function getMask(tileRatio, topTab, rightTab, bottomTab, leftTab, tileWidth) {

        var curvyCoords = [
            0, 0, 35, 15, 37, 5,
            37, 5, 40, 0, 38, -5,
            38, -5, 20, -20, 50, -20,
            50, -20, 80, -20, 62, -5,
            62, -5, 60, 0, 63, 5,
            63, 5, 65, 15, 100, 0
        ];

        var mask = new Path();
        var tileCenter = view.center;

        var topLeftEdge = new Point(0, 0);

        mask.moveTo(topLeftEdge);
        var topEdge = new Path();
        topEdge.moveTo(topLeftEdge);
        //Top
        mask.add(new Point(0,0));
        mask.add(new Point(instance.tileWidth,0));
        topEdge.add(new Point(0,0));
        topEdge.add(new Point(instance.tileWidth,0));
        for (var i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = topLeftEdge + new Point(curvyCoords[i * 6 + 0] * tileRatio, topTab * curvyCoords[i * 6 + 1] * tileRatio);
            var p2 = topLeftEdge + new Point(curvyCoords[i * 6 + 2] * tileRatio, topTab * curvyCoords[i * 6 + 3] * tileRatio);
            var p3 = topLeftEdge + new Point(curvyCoords[i * 6 + 4] * tileRatio, topTab * curvyCoords[i * 6 + 5] * tileRatio);

            // mask.cubicCurveTo(p1, p2, p3);
            // topEdge.cubicCurveTo(p1, p2, p3);

        }

        //Right
        var topRightEdge = topLeftEdge + new Point(tileWidth, 0);
        var rightEdge = new Path();
        rightEdge.moveTo(topRightEdge);
        mask.add(new Point(instance.tileWidth,instance.tileWidth));
        topEdge.add(new Point(instance.tileWidth,0));
        topEdge.add(new Point(instance.tileWidth,instance.tileWidth));
        for (var i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = topRightEdge + new Point(-rightTab * curvyCoords[i * 6 + 1] * tileRatio, curvyCoords[i * 6 + 0] * tileRatio);
            var p2 = topRightEdge + new Point(-rightTab * curvyCoords[i * 6 + 3] * tileRatio, curvyCoords[i * 6 + 2] * tileRatio);
            var p3 = topRightEdge + new Point(-rightTab * curvyCoords[i * 6 + 5] * tileRatio, curvyCoords[i * 6 + 4] * tileRatio);
            // mask.cubicCurveTo(p1, p2, p3);
            // rightEdge.cubicCurveTo(p1, p2, p3);
        }

        //Bottom
        var bottomRightEdge = topRightEdge + new Point(0, tileWidth);
        var bottomEdge = new Path();
        bottomEdge.moveTo(bottomRightEdge);
        mask.add(new Point(0,instance.tileWidth));
        bottomEdge.add(new Point(0,instance.tileWidth));
        bottomEdge.add(new Point(instance.tileWidth,instance.tileWidth));
        for (var i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = bottomRightEdge - new Point(curvyCoords[i * 6 + 0] * tileRatio, bottomTab * curvyCoords[i * 6 + 1] * tileRatio);
            var p2 = bottomRightEdge - new Point(curvyCoords[i * 6 + 2] * tileRatio, bottomTab * curvyCoords[i * 6 + 3] * tileRatio);
            var p3 = bottomRightEdge - new Point(curvyCoords[i * 6 + 4] * tileRatio, bottomTab * curvyCoords[i * 6 + 5] * tileRatio);

            // mask.cubicCurveTo(p1, p2, p3);
            // bottomEdge.cubicCurveTo(p1, p2, p3);
        }

        //Left
        var bottomLeftEdge = bottomRightEdge - new Point(tileWidth, 0);
        var leftEdge = new Path();
        leftEdge.moveTo(bottomLeftEdge);
        leftEdge.add(new Point(0,0));
        leftEdge.add(new Point(0,instance.tileWidth));
        for (var i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = bottomLeftEdge - new Point(-leftTab * curvyCoords[i * 6 + 1] * tileRatio, curvyCoords[i * 6 + 0] * tileRatio);
            var p2 = bottomLeftEdge - new Point(-leftTab * curvyCoords[i * 6 + 3] * tileRatio, curvyCoords[i * 6 + 2] * tileRatio);
            var p3 = bottomLeftEdge - new Point(-leftTab * curvyCoords[i * 6 + 5] * tileRatio, curvyCoords[i * 6 + 4] * tileRatio);

            // mask.cubicCurveTo(p1, p2, p3);
            // leftEdge.cubicCurveTo(p1, p2, p3);
        }
        maskMap = {
            mask: mask,
            topEdge: topEdge,
            rightEdge: rightEdge,
            bottomEdge: bottomEdge,
            leftEdge: leftEdge
        };
        return maskMap;
    }

    var hitOptions = {
        segments: true,
        stroke: true,
        fill: true,
        tolerance: 5
    };

    function createVoronoiTiles(xTileCount, yTileCount) {
        var tiles = new Array();
        var tileIndexes = new Array();
        for (var y = 0; y < yTileCount; y++) {
            for (var x = 0; x < xTileCount; x++) {
                var tileIndex = tileIndexes.length;
                var topLeftPoint = new Point(0, 0);
                var topRightPoint = new Point(0, 0);
                var bottomLeftPoint = new Point(0, 0);
                var bottomRightPoint = new Point(0, 0);

                bottomRightPoint.x = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                bottomRightPoint.y = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);

                if (x > 0) {
                    var leftTile = tiles[tileIndex - 1];
                    topLeftPoint = leftTile.topRightPoint - new Point(instance.tileWidth, 0);
                    bottomLeftPoint = leftTile.bottomRightPoint - new Point(instance.tileWidth, 0);
                }

                if (y > 0) {
                    var topTile = tiles[tileIndex - instance.tilesPerRow];
                    topLeftPoint = topTile.bottomLeftPoint - new Point(0, instance.tileWidth);
                    topRightPoint = topTile.bottomRightPoint - new Point(0, instance.tileWidth);
                }

                if (x == 0) {
                    if (y == 0) {
                        topRightPoint.x = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);

                        bottomLeftPoint.y = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);

                        bottomRightPoint.x = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                        bottomRightPoint.y = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                    }
                    else if (y == yTileCount - 1) {
                        bottomLeftPoint.y = instance.tileWidth;

                        bottomRightPoint.x = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                        bottomRightPoint.y = instance.tileWidth;
                    }
                    else {
                        bottomLeftPoint.y = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                        ;

                        bottomRightPoint.x = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                        bottomRightPoint.y = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                    }
                }
                else if (x == xTileCount - 1) {
                    if (y == 0) {
                        topRightPoint.x = instance.tileWidth;

                        bottomRightPoint.x = instance.tileWidth;
                        bottomRightPoint.y = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                    }
                    else if (y == yTileCount - 1) {
                        bottomRightPoint.x = instance.tileWidth;
                        bottomRightPoint.y = instance.tileWidth;
                    }
                    else {
                        bottomRightPoint.x = instance.tileWidth;
                        bottomRightPoint.y = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                    }
                }
                else {
                    if (y == 0) {
                        topRightPoint.x = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);

                        bottomRightPoint.x = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                        bottomRightPoint.y = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                    }
                    else if (y == yTileCount - 1) {
                        bottomRightPoint.x = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                        bottomRightPoint.y = instance.tileWidth;
                    }
                    else {
                        bottomRightPoint.x = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                        bottomRightPoint.y = Math.round(instance.tileWidth / 2 + Math.random() * instance.tileWidth);
                    }
                }

                var mask = new Path();
                mask.moveTo(topLeftPoint);
                mask.lineTo(topRightPoint);
                mask.lineTo(bottomRightPoint);
                mask.lineTo(bottomLeftPoint);
                mask.closePath();
                mask.opacity = 0.01;
                mask.strokeColor = '#fff'; //white

                var img = getTileRaster(
                    instance.puzzleImage,
                    new Size(instance.tileWidth, instance.tileWidth),
                    new Point(instance.tileWidth * x, instance.tileWidth * y)
                );


                //var border = mask.clone();
                //border.strokeColor = 'red'; //grey
                //border.strokeWidth = 0;

                // each tile is a group of
                var tile = new Group(mask, img);
                tile.topRightPoint = topRightPoint;
                tile.topLeftPoint = topLeftPoint;
                tile.bottomLeftPoint = bottomLeftPoint;
                tile.bottomRightPoint = bottomRightPoint;
                tile.picking = false;
                tile.clipped = true;
                tile.opacity = 1;
                tile.pivot = new Point(instance.tileWidth / 2, instance.tileWidth / 2);

                tile.imagePosition = new Point(x, y);

                // tile fixed index/unique id
                tile.findex = y * xTileCount + x;
                //console.log(tile.findex);
                tiles.push(tile);
                tile.name = "tile-" + tileIndexes.length;
                tileIndexes.push(tileIndexes.length);
            }
        }
        instance.tileIndexes = tileIndexes;
        return tiles;
    }


    function getTileRaster(sourceRaster, size, offset) {
        //var targetRaster = new Raster('');
        //console.log("targetRaster1",targetRaster);
        var tileWithMarginWidth = size.width + instance.tileMarginWidth * 2;
        // var imageData = sourceRaster.getImageData(new Rectangle(
        //     offset.x - instance.tileMarginWidth,
        //     offset.y - instance.tileMarginWidth,
        //     tileWithMarginWidth,
        //     tileWithMarginWidth));
        // console.log("imageData",imageData);
        var targetRaster = sourceRaster.getSubRaster(new Rectangle(
            offset.x - instance.tileMarginWidth,
            offset.y - instance.tileMarginWidth,
            tileWithMarginWidth,
            tileWithMarginWidth));
        //targetRaster.setImageData(imageData, new Point(0, 0));
        targetRaster.position = new Point(instance.tileWidth / 2, instance.tileWidth / 2);
        return targetRaster;
    }

    function getTileIndex(tile) {
        if (tile && tile.name) {
            return Number(tile.name.substr(5));
        }
        return -1;
    }

    this.pickTile = function (point) {
        // if (instance.hintsShowing) {
        //     return;
        // }
        findSelectTile(point);
        if (instance.selectedTile) {
            $('html,body').css('cursor', 'move');
            if (!instance.selectedTile[0].picking) {
                for (var i = 0; i < instance.selectedTile.length; i++) {
                    instance.selectedTile[i].picking = true;
                }
            }
            else {
                instance.releaseTile();
                return;
            }

            instance.draging = true;

            var pos = new Point(instance.selectedTile[0].position.x, instance.selectedTile[0].position.y);
            var tile = instance.selectedTile[0];
            //console.log("pick tile",tile);
            tile.opacity = 0.5;
            tile.position = pos;
            tile.originPosition = tile.position;
            tile.originCellPosition = tile.cellPosition;
            tile.originArea = tile.area;
            return instance.selectedTile.length;
        }
        return 0;
    }

    function moveAwayDelay(tile, d) {
        if ((tile.wantToMoveAway >= 0 && tile.wantToMoveAway != d) || !tile.noAroundTiles) {
            return false;
        }
        tile.wantToMoveAway = d;
        var cellPositionAfter = tile.cellPosition + directions[d];

        for (var i = 0; i < 4; i++) {
            var neighborTile = getTileAtCellPosition(cellPositionAfter + directions[i]);
            if (neighborTile != undefined && tile != neighborTile) {
                var canMoveAway = moveAwayDelay(neighborTile, d);
                if (!canMoveAway) {
                    return false;
                }
            }
        }

        return true;
    }

    function allMoveAway() {
        for (var i = 0; i < instance.tiles.length; i++) {
            var tile = instance.tiles[i];
            if (tile.wantToMoveAway >= 0 && tile.noAroundTiles) {
                placeTile(tile, tile.cellPosition + directions[tile.wantToMoveAway]);
                tile.wantToMoveAway = -1;
            }
        }
    }

    function checkConflict(tile) {
        var tilePosition = tile.position;
        var xPosition = Math.floor((tilePosition.x - instance.candidateAreaPosition.x)/instance.tileWidth);
        var yPosition = Math.floor((tilePosition.y - instance.candidateAreaPosition.y)/instance.tileWidth);
        if(xPosition>=0 && xPosition<instance.tilesPerRow && yPosition>=0 && yPosition<instance.tilesPerColumn){
            if(!instance.candidateAreaArray[instance.tilesPerRow*yPosition+xPosition]){
                return [false, 0, xPosition, yPosition];
            }
            else{
                return [true,null,null,null];
            }
        }
        var xPosition = Math.floor((tilePosition.x - instance.playerAreaPosition.x)/instance.tileWidth);
        var yPosition = Math.floor((tilePosition.y - instance.playerAreaPosition.y)/instance.tileWidth);
        if(xPosition>=0 && xPosition<instance.tilesPerRow && yPosition>=0 && yPosition<instance.tilesPerColumn){
            if(!instance.playerAreaArray[instance.tilesPerRow*yPosition+xPosition]){
                var conflict = false;
                if(xPosition>0){
                    var left = instance.playerAreaArray[instance.tilesPerRow*yPosition+xPosition-1];
                    if(left){
                        if(left.findex != tile.findex){
                            var tileLeftEdge = instance.tileInformation[tile.findex][3];
                            var leftRightEdge = instance.tileInformation[left.findex][1];
                            if(tileLeftEdge != leftRightEdge)
                                conflict = true;
                        }
                    }
                }
                if(xPosition<instance.tilesPerRow-1){
                    var right = instance.playerAreaArray[instance.tilesPerRow*yPosition+xPosition+1];
                    if(right){
                        if(right.findex != tile.findex){
                            var tileLeftEdge = instance.tileInformation[tile.findex][1];
                            var rightLeftEdge = instance.tileInformation[right.findex][3];
                            if(tileLeftEdge != rightLeftEdge)
                                conflict = true;
                        }
                    }
                }
                if(yPosition>0){
                    var top = instance.playerAreaArray[instance.tilesPerRow*(yPosition-1)+xPosition];
                    if(top){
                        if(top.findex != tile.findex){
                            var tileTopEdge = instance.tileInformation[tile.findex][0];
                            var topBottomEdge = instance.tileInformation[top.findex][2];
                            if(tileTopEdge != topBottomEdge)
                                conflict = true;
                        }
                    }
                }
                if(yPosition<instance.tilesPerColumn-1){
                    var bottom = instance.playerAreaArray[instance.tilesPerRow*(yPosition+1)+xPosition];
                    if(bottom){
                        if(bottom.findex != tile.findex){
                            var tileBottomEdge = instance.tileInformation[tile.findex][2];
                            var bottomTopEdge = instance.tileInformation[bottom.findex][0];
                            if(tileBottomEdge != bottomTopEdge)
                                conflict = true;
                        }
                    }
                }
                return [conflict, 1, xPosition, yPosition];
            }
            else{
                return [true,null,null,null];
            }
        }
        return [true,null,null,null];


    }
    // function checkConflict(tiles, centerCellPosition, selectedGroupTiles) {
    //     if (Math.abs(centerCellPosition.x) > 70 || Math.abs(centerCellPosition.y) > 50) {
    //         return true;
    //     }
    //     var hasConflict = false;
    //     var needToMove = true;
    //     if (this.allowOverlap)
    //         return hasConflict;
    //     var onlyOneTile = (tiles.length == 1);
    //     for (var i = 0; i < tiles.length; i++) {
    //         if (hasConflict && !needToMove)
    //             break;
    //         var tile = tiles[i];
    //         var tileIndex = getTileIndex(tile);
    //
    //         var cellPosition = centerCellPosition + tile.relativePosition;
    //         var roundPosition = cellPosition * instance.tileWidth;
    //
    //         var alreadyPlacedTile = (getTileAtCellPosition(cellPosition) != undefined);
    //
    //         if (alreadyPlacedTile && (typeof selectedGroupTiles !== 'undefined')) {
    //             var theTile = getTileAtCellPosition(cellPosition);
    //             for (var j = 0; j < selectedGroupTiles.length; j++) {
    //                 if (selectedGroupTiles[j] == theTile) {
    //                     needToMove = false;
    //                     break;
    //                 }
    //             }
    //         }
    //         hasConflict = hasConflict || alreadyPlacedTile;
    //         if (!hasConflict && instance.tileShape != "voronoi") {
    //             var topTile = getTileAtCellPosition(cellPosition + new Point(0, -1));
    //             var rightTile = getTileAtCellPosition(cellPosition + new Point(1, 0));
    //             var bottomTile = getTileAtCellPosition(cellPosition + new Point(0, 1));
    //             var leftTile = getTileAtCellPosition(cellPosition + new Point(-1, 0));
    //
    //             var hintAroundTiles = undefined;
    //             if (instance.hintsShowing) {
    //                 hintAroundTiles = instance.hintAroundTilesMap[tileIndex];
    //             }
    //
    //             var topTileConflict = (topTile != undefined) && (!(topTile.shape.bottomTab + tile.shape.topTab == 0) ||
    //                 (instance.tileShape == 'curved' && topTile.shape.bottomTab == 0 && tile.shape.topTab == 0));
    //             if (hintAroundTiles) {
    //                 topTileConflict = topTileConflict || (topTile != undefined) && (getTileIndex(topTile) != hintAroundTiles[0]);
    //                 if (topTileConflict && tile.aroundTiles[0] < 0 && onlyOneTile) {
    //                     var canMoveAway = false;//moveAwayDelay(topTile, 0);
    //                     if (canMoveAway) {
    //                         topTileConflict = false;
    //                     }
    //                 }
    //             }
    //             if (topTileConflict && (typeof selectedGroupTiles !== 'undefined')) {
    //                 for (var j = 0; j < selectedGroupTiles.length; j++) {
    //                     if (selectedGroupTiles[j] == topTile) {
    //                         needToMove = false;
    //                         break;
    //                     }
    //                 }
    //             }
    //
    //             var rightTileConflict = (rightTile != undefined) && (!(rightTile.shape.leftTab + tile.shape.rightTab == 0) ||
    //                 (instance.tileShape == 'curved' && rightTile.shape.leftTab == 0 && tile.shape.rightTab == 0));
    //             if (hintAroundTiles) {
    //                 rightTileConflict = rightTileConflict || (rightTile != undefined) && (getTileIndex(rightTile) != hintAroundTiles[1]);
    //                 if (rightTileConflict && tile.aroundTiles[1] < 0 && onlyOneTile) {
    //                     var canMoveAway = false;//moveAwayDelay(rightTile, 1);
    //                     if (canMoveAway) {
    //                         rightTileConflict = false;
    //                     }
    //                 }
    //             }
    //             if (rightTileConflict && (typeof selectedGroupTiles !== 'undefined')) {
    //                 for (var j = 0; j < selectedGroupTiles.length; j++) {
    //                     if (selectedGroupTiles[j] == rightTile) {
    //                         needToMove = false;
    //                         break;
    //                     }
    //                 }
    //             }
    //
    //             var bottomTileConflict = (bottomTile != undefined) && (!(bottomTile.shape.topTab + tile.shape.bottomTab == 0) ||
    //                 (instance.tileShape == 'curved' && bottomTile.shape.topTab == 0 && tile.shape.bottomTab == 0));
    //             if (hintAroundTiles) {
    //                 bottomTileConflict = bottomTileConflict || (bottomTile != undefined) && (getTileIndex(bottomTile) != hintAroundTiles[2]);
    //                 if (bottomTileConflict && tile.aroundTiles[2] < 0 && onlyOneTile) {
    //                     var canMoveAway = false;//moveAwayDelay(bottomTile, 2);
    //                     if (canMoveAway) {
    //                         bottomTileConflict = false;
    //                     }
    //                 }
    //             }
    //             if (bottomTileConflict && (typeof selectedGroupTiles !== 'undefined')) {
    //                 for (var j = 0; j < selectedGroupTiles.length; j++) {
    //                     if (selectedGroupTiles[j] == bottomTile) {
    //                         needToMove = false;
    //                         break;
    //                     }
    //                 }
    //             }
    //
    //             var leftTileConflict = (leftTile != undefined) && (!(leftTile.shape.rightTab + tile.shape.leftTab == 0) ||
    //                 (instance.tileShape == 'curved' && leftTile.shape.rightTab == 0 && tile.shape.leftTab == 0));
    //             if (hintAroundTiles) {
    //                 leftTileConflict = leftTileConflict || (leftTile != undefined) && (getTileIndex(leftTile) != hintAroundTiles[3]);
    //                 if (leftTileConflict && tile.aroundTiles[3] < 0 && onlyOneTile) {
    //                     var canMoveAway = false;//moveAwayDelay(leftTile, 3);
    //                     if (canMoveAway) {
    //                         leftTileConflict = false;
    //                     }
    //                 }
    //             }
    //             if (leftTileConflict && (typeof selectedGroupTiles !== 'undefined')) {
    //                 for (var j = 0; j < selectedGroupTiles.length; j++) {
    //                     if (selectedGroupTiles[j] == leftTile) {
    //                         needToMove = false;
    //                         break;
    //                     }
    //                 }
    //             }
    //
    //             var aroundConflict = topTileConflict || bottomTileConflict || rightTileConflict || leftTileConflict;
    //             var hasConflict = aroundConflict || hasConflict;
    //         }
    //     }
    //     if (!hasConflict) {
    //         allMoveAway();
    //     }
    //     return [hasConflict, needToMove];
    // }

    function placeTile(tile, newPosition, newArea, newx, newy) {
        // var roundPosition = cellPosition * instance.tileWidth;
        // if (instance.hintsShowing) {
        //     tile.preStep = instance.steps - 1;
        // }
        // else {
        //     tile.preStep = instance.steps;
        // }
        // tile.preCellPosition = tile.cellPosition;
        tile.position = newPosition;
        if (tile.originPosition) {
            if (newPosition == tile.originPosition) {
                tile.positionMoved = false;
            }
            else {
                tile.positionMoved = true;
            }
        }
        else {
            tile.positionMoved = false;
        }
        if(tile.originArea == 0 && tile.originCellPosition){
            var x = tile.originCellPosition.x;
            var y = tile.originCellPosition.y;
            instance.candidateAreaArray[y*instance.tilesPerRow+x]=null;
            tile.area = newArea;
            tile.cellPosition = new Point(newx,newy);
            if(newArea == 0)
            {
                instance.candidateAreaArray[newy*instance.tilesPerRow+newx]=tile;
            }
            else
                instance.playerAreaArray[newy*instance.tilesPerRow+newx]=tile;
        }
        else if(tile.originArea == 1 && tile.originCellPosition){
            var x = tile.originCellPosition.x;
            var y = tile.originCellPosition.y;
            instance.playerAreaArray[y*instance.tilesPerRow+x]=null;
            tile.area = newArea;
            tile.cellPosition = new Point(newx,newy);
            if(newArea == 0)
            {
                instance.candidateAreaArray[newy*instance.tilesPerRow+newx]=tile;
            }
            else
                instance.playerAreaArray[newy*instance.tilesPerRow+newx]=tile;
        }
        // tile.cellPosition = cellPosition;
        // tile.relativePosition = new Point(0, 0);
    }

    this.undoNextStep = function () {
        // instance.undoing = true;
        //
        // var tilesMoved = false;
        //
        // for (var i = 0; i < instance.tiles.length; i++) {
        //     var tile = instance.tiles[i];
        //     tile.beenUndo = false;
        //     if (tile.preStep == instance.steps - 1) {
        //         tile.beenUndo = true;
        //         placeTile(tile, tile.preCellPosition);
        //         tilesMoved = true;
        //     }
        // }

        // for (var i = 0; i < instance.tiles.length; i++) {
        //     var tile = instance.tiles[i];
        //     if (tile.beenUndo) {
        //         refreshAroundTiles(tile, false);
        //     }
        // }

        // for (var i = 0; i < instance.tiles.length; i++) {
        //     var tile = instance.tiles[i];
        //     if (tile.beenUndo) {
        //         if (tile.aroundTilesChanged) {
        //             computeSubGraph(tile);
        //         }
        //         tile.beenUndo = false;
        //     }
        // }
        //
        // computeGraphData();
        //
        // if (tilesMoved) {
        //     instance.steps += 1;
        //     instance.realStepsCounted = false;
        //
        //     document.getElementById("steps").innerHTML = instance.realSteps;
        //     undoStep = instance.steps;
        //     $('#undo_button').css('display', 'none');
        //     saveGame();
        //     normalizeTiles();
        // }
        //
        // instance.undoing = false;
        //instance.undoing = true;
        for(var j=0; j<instance.tilesPerColumn; j++)
            for(var i=0; i<instance.tilesPerRow; i++)
            {
                var tile = instance.tiles[j*instance.tilesPerRow+i];
                var position = instance.candidateAreaPosition + new Point((i + 0.5) * instance.tileWidth, (j + 0.5) * instance.tileWidth);
                tile.position = position;
                tile.cellPosition = new Point(i, j);
                tile.area = 0;
                instance.candidateAreaArray[j*instance.tilesPerRow+i]=tile;
                instance.playerAreaArray[j*instance.tilesPerRow+i] = null;
            }
        //instance.undoing = false;
    }

    this.checkSquare = function () {
        var firsti = -1
        var firstj = -1;
        for(var j=0; j<instance.tilesPerColumn; j++) {
            for (var i = 0; i < instance.tilesPerRow; i++) {
                if (instance.playerAreaArray[j * instance.tilesPerRow + i]) {
                    firsti = i;
                    firstj = j;
                    break;
                }
            }
            if(firsti!=-1)
            {
                break;
            }
        }
        var squareSize = 0;
        for(var i = firsti; i<instance.tilesPerRow; i++)
        {
            if(instance.playerAreaArray[firstj*instance.tilesPerRow+i])
            {
                squareSize++;
            }
            else
                break;
        }
        console.log("firsti:",firsti," firstj:",firstj," size:",squareSize);
        if(squareSize<2)
            return [false,null,null,null];

        if(firstj+squareSize > instance.tilesPerColumn)
            return [false,null,null,null];
        var valid = true;
        for(var j=0; j<instance.tilesPerColumn; j++)
            for(var i=0; i<instance.tilesPerRow; i++)
            {
                var tile = instance.playerAreaArray[j*instance.tilesPerRow+i];
                if(i>=firsti && i<firsti+squareSize && j>=firstj && j<firstj+squareSize)
                {
                    if(!tile)
                        valid = false;
                }
                else
                {
                    if(tile)
                        valid = false;
                }
            }
        return [valid,firsti,firstj,squareSize];

    }

    this.uploadUserGraph = function(firsti, firstj, size)
    {
        tileIndexArray  = new Array();
        for(var j = firstj; j< firstj+size ; j++)
            for(var i = firsti; i<firsti+size; i++)
            {
                var index = instance.playerAreaArray[j*instance.tilesPerRow+i].findex;
                tileIndexArray.push(index);
            }
        socket.emit('uploadUserGraph',{
            round_id: roundID,
            player_name: player_name,
            tileIndexArray: tileIndexArray,
            size: size
        });

    }

    this.getHint = function (hintSize) {
        socket.emit('getHint',{
            round_id: roundID,
            player_name: player_name,
            hintSize: hintSize
        });
    }

    this.upMove = function () {
        var valid = true;
        for(var i=0; i<instance.tilesPerRow ;i++){
            if(instance.playerAreaArray[i]){
                valid = false;
                break;
            }
        }
        if(valid){
            for(var j=0; j<instance.tilesPerColumn; j++)
                for(var i=0; i<instance.tilesPerRow; i++){
                    tile = instance.playerAreaArray[j*instance.tilesPerRow+i];
                    if(tile){
                        tile.cellPosition = tile.cellPosition + new Point(0,-1);
                        tile.position = tile.position + new Point(0,0-instance.tileWidth);
                        instance.playerAreaArray[(j-1)*instance.tilesPerRow+i] = tile;
                        instance.playerAreaArray[j*instance.tilesPerRow+i] = null;
                    }
                }
        }

    };
    this.rightMove = function () {
        var valid = true;
        for(var j=0; j<instance.tilesPerColumn; j++){
            if(instance.playerAreaArray[j*instance.tilesPerRow+instance.tilesPerRow-1]){
                valid = false;
                break;
            }
        }
        if(valid){
            for(var j=0; j<instance.tilesPerColumn ;j++)
                for(var i=instance.tilesPerRow-1 ; i>=0 ;i--){
                    tile = instance.playerAreaArray[j*instance.tilesPerRow+i];
                    if(tile){
                        tile.cellPosition = tile.cellPosition + new Point(1,0);
                        tile.position = tile.position + new Point(instance.tileWidth,0);
                        instance.playerAreaArray[j*instance.tilesPerRow+i+1] = tile;
                        instance.playerAreaArray[j*instance.tilesPerRow+i] = null;
                    }
                }
        }
    };
    this.downMove = function () {
        var valid = true;
        for(var i=0; i<instance.tilesPerRow ;i++){
            if(instance.playerAreaArray[(instance.tilesPerColumn-1)*instance.tilesPerRow+i]){
                valid = false;
                break;
            }
        }
        if(valid){
            for(var j=instance.tilesPerColumn-1; j>=0; j--)
                for(var i=0; i<instance.tilesPerRow; i++){
                    tile = instance.playerAreaArray[j*instance.tilesPerRow+i];
                    if(tile){
                        tile.cellPosition = tile.cellPosition + new Point(0,1);
                        tile.position = tile.position + new Point(0,instance.tileWidth);
                        instance.playerAreaArray[(j+1)*instance.tilesPerRow+i] = tile;
                        instance.playerAreaArray[j*instance.tilesPerRow+i] = null;
                    }
                }
        }

    };
    this.leftMove = function () {
        var valid = true;
        for(var j=0; j<instance.tilesPerColumn; j++){
            if(instance.playerAreaArray[j*instance.tilesPerRow]){
                valid = false;
                break;
            }
        }
        if(valid){
            for(var j=0; j<instance.tilesPerColumn ;j++)
                for(var i=0; i<instance.tilesPerRow ;i++){
                    tile = instance.playerAreaArray[j*instance.tilesPerRow+i];
                    if(tile){
                        tile.cellPosition = tile.cellPosition + new Point(-1,0);
                        tile.position = tile.position + new Point(0-instance.tileWidth,0);
                        instance.playerAreaArray[j*instance.tilesPerRow+i-1] = tile;
                        instance.playerAreaArray[j*instance.tilesPerRow+i] = null;
                    }
                }
        }

    };

    function generateLinksTags(x, y, direction, beHinted) {
        switch (direction) {
            case 0:
                return {x: Number(y), y: Number(x), tag: "T-B", beHinted: beHinted};
            case 1:
                return {x: Number(x), y: Number(y), tag: "L-R", beHinted: beHinted};
            case 2:
                return {x: Number(x), y: Number(y), tag: "T-B", beHinted: beHinted};
            case 3:
                return {x: Number(y), y: Number(x), tag: "L-R", beHinted: beHinted};
        }
    }

    function dfsGraph(tileIndex) {
        // if (instance.dfsGraphLinksMap[tileIndex]) {
        //     return;
        // }
        // instance.dfsGraphLinksMap[tileIndex] = new Array();
        // instance.subGraphNodesCount += 1;
        // var tile = instance.tiles[tileIndex];
        // for (var i = 0; i < tile.aroundTiles.length; i++) {
        //     var aroundTileIndex = tile.aroundTiles[i];
        //     if (aroundTileIndex < 0 || (instance.dfsGraphLinksMap[aroundTileIndex] &&
        //         instance.dfsGraphLinksMap[aroundTileIndex][tileIndex])) {
        //         continue;
        //     }
        //     instance.dfsGraphLinksMap[tileIndex][aroundTileIndex] = true;
        //     var beHinted = (aroundTileIndex == Math.floor(tile.hintedLinks[i]));
        //     instance.subGraphData.push(generateLinksTags(tileIndex, aroundTileIndex, i, beHinted));
        //     dfsGraph(aroundTileIndex);
        // }
    }

    function updateGraphSize(preSize) {
        // var size = instance.subGraphData.length - preSize;
        // var nodes = instance.subGraphNodesCount;
        // for (var i = preSize; i < instance.subGraphData.length; i++) {
        //     instance.subGraphData[i].size = size;
        //     instance.subGraphData[i].nodes = nodes;
        // }
    }

    function askHelp() {
        // if(players_num == 1){
        //     return;
        // }
        // if (instance.gameFinished || instance.forceLeaving) {
        //     return;
        // }
        //
        // console.log("Asking for help...");
        // clearTimeout(instance.askHelpTimeout);
        //
        // if (mousedowned || instance.hintsShowing) {
        //     return;
        // }
        //
        // $('#show_hints_dialog').modal({
        //     keyboard: false,
        //     backdrop: false
        // }).show();
        //
        // socket.emit("fetchHints", {
        //     round_id: roundID,
        //     player_name: player_name,
        //     tilesNum: instance.tilesNum
        // });
    }

    socket.on("proactiveHints", function (data) {
        // console.log(data);
        // if (!mousedowned && !instance.hintsShowing && data && data.sureHints) {
        //     if (!instance.hintsShowing) {
        //         instance.hintsShowing = true;
        //     }
        //     else {
        //         return;
        //     }
        //
        //     var shouldSave = false;
        //
        //     instance.hintsLog = {
        //         type: 'proactive',
        //         hints: JSON.stringify(data.sureHints),
        //         log: new Array(),
        //     };
        //     instance.hintAroundTilesMap = data.sureHints;
        //
        //     var strongHintsNeededTiles = new Array();
        //     for (var index = 0; index < instance.tiles.length; index++) {
        //         var tile = instance.tiles[index];
        //         for (var j = 0; j < 4; j++) {
        //             if (tile.aroundTiles[j] < 0 && data.sureHints[index][j] > -1) {
        //                 strongHintsNeededTiles.push(index);
        //                 break;
        //             }
        //         }
        //     }
        //
        //     var shouldSave = showStrongAndWeakHints(data.sureHints, strongHintsNeededTiles);
        //
        //     if (shouldSave) {
        //         saveGame();
        //     }
        //
        //     computeHintedSubGraph();
        //     normalizeTiles();
        //
        //     $("#show_hints_dialog").modal().hide();
        //
        //     // judge the hint tiles
        //     if (!instance.gameFinished) {
        //         var errors = checkTiles();
        //         if (errors == 0) {
        //             finishGame();
        //         }
        //     }
        //
        //     if (!shouldSave){
        //         processUnsureHints(data.unsureHints);
        //     }
        //     instance.hintsShowing = false;
        // }
        // else {
        //     $("#show_hints_dialog").modal().hide();
        // }
    });

    this.releaseTile = function () {
        if (instance.draging) {
            // var centerCellPosition = new Point(
            //     Math.round(instance.selectedTile[0].position.x / instance.tileWidth),
            //     Math.round(instance.selectedTile[0].position.y / instance.tileWidth));

            //var originCenterCellPostion = instance.selectedTile[0].originPosition;

            // console.log("releaseTile cellPosition : x : " + centerCellPosition.x + " y : " + centerCellPosition.y);
            var hasConflicts = checkConflict(instance.selectedTile[0]);
            //console.log("hasConflicts",hasConflicts);
            var hasConflict = hasConflicts[0];
            for (var i = 0; i < instance.selectedTile.length; i++) {
                instance.selectedTile[i].picking = false;
            }

            var tilesMoved = false;
            // for (var i = 0; i < instance.selectedTile.length; i++) {
            //     var tile = instance.selectedTile[i];
            //     var cellPosition = undefined;
            //     if (hasConflict) {
            //         cellPosition = originCenterCellPostion + tile.relativePosition;
            //     }
            //     else {
            //         cellPosition = centerCellPosition + tile.relativePosition;
            //     }
            //     placeTile(tile, cellPosition);
            //     tilesMoved = tilesMoved || tile.positionMoved;
            //
            //     if (tile.differentColor.length > 0) {
            //         var tileIndex = getTileIndex(tile);
            //         for (var j = 0; j < tile.differentColor.length; j++) {
            //             showColorBorder(tileIndex, tile.differentColor[j], tile.colorDirection[j], false);
            //         }
            //     }
            // }
            if(hasConflict){
                instance.selectedTile[0].position = instance.selectedTile[0].originPosition;
            }
            else{
                if(hasConflicts[1]==0){
                    var x = hasConflicts[2];
                    var y = hasConflicts[3];
                    var newPosition = instance.candidateAreaPosition + new Point((x+0.5)*instance.tileWidth,(y+0.5)*instance.tileWidth);
                    placeTile(tile,newPosition,0,x,y);
                    tilesMoved = tilesMoved || tile.positionMoved;
                }
                else if(hasConflicts[1]==1){
                    var x = hasConflicts[2];
                    var y = hasConflicts[3];
                    var newPosition = instance.playerAreaPosition + new Point((x+0.5)*instance.tileWidth,(y+0.5)*instance.tileWidth);
                    placeTile(tile,newPosition,1,x,y);
                    tilesMoved = tilesMoved || tile.positionMoved;
                }
            }
            // console.log("array0",instance.candidateAreaArray);
            // console.log("array1",instance.playerAreaArray);

            // for (var i = 0; i < instance.selectedTile.length; i++) {
            //     refreshAroundTiles(instance.selectedTile[i], false);
            // }

            // for (var i = 0; i < instance.selectedTile.length; i++) {
            //     var tile = instance.selectedTile[i];
            //     if (tile.aroundTilesChanged) {
            //         computeSubGraph(tile);
            //     }
            // }
            //
            // computeGraphData();

            if (tilesMoved && !instance.gameFinished) {
                instance.steps += 1;
                console.log("steps",instance.steps);
                document.getElementById("steps").innerHTML = instance.steps;
                instance.realStepsCounted = false;
                //document.getElementById("steps").innerHTML = instance.realSteps;
                //$('#undo_button').css('display', 'inline');
                saveGame();
            }

            // if (!hasConflict && instance.showHints) {
            //     var selectedTileIndexes = new Array();
            //     for (var i = 0; i < instance.selectedTile.length; i++) {
            //         selectedTileIndexes.push(getTileIndex(instance.selectedTile[i]));
            //     }
            //     getHints(roundID, selectedTileIndexes);
            // }

            for (var i = 0; i < instance.selectedTile.length; i++) {
                instance.selectedTile[i].opacity = 1;
            }

            instance.selectedTile = null;
            instance.draging = false;

            // if (!instance.gameFinished) {
            //     var errors = checkTiles();
            //     if (errors == 0) {
            //         finishGame();
            //         clearTimeout(instance.askHelpTimeout);
            //     }
            // }
            if(!instance.gameFinished){
                var sum = 0;
                for(var j=0; j<instance.tilesPerColumn; j++)
                    for(var i=0; i<instance.tilesPerRow; i++)
                    {
                        if(instance.playerAreaArray[j*instance.tilesPerRow+i])
                            sum++;
                    }
                if(sum == instance.tilesNum){
                    finishGame();
                }
            }
            $('html,body').css('cursor', 'default');
            // normalizeTiles();
        }
    }

    /**
     *  Update links in the background graph
     *  Check which case it is in the 4 cases, and call the corrosponding method:
     *  *  When one link is created:
     *  1, If the link does not exist, create a link;
     *  2, If the link already exists, update: append the user to the supporter list of the selected tile;
     *  *  When one link is destroyed:
     *  1, If the user is the only one supporter, remove;
     *  2, Else update: remove the user from the supporter list of the 2 tiles
     */

    /**
     * Check links change of the selected tile(s), and update the database
     * @param selectedTileIndex  Number the selected tile index
     * @param aroundTilesBefore  Tiles indexes around the selected before one step
     * @param aroundTilesAfter  Tiles indexes around the selected after one step
     * e.g. ({
        "round_id":0,
        "selectedTile": 1,
        "aroundTiles":[{
            "before": -1,
            "after": 3
        },{
            "before": -1,
            "after": -1
        },{
                "before": 2,
            "after": 3
        },{
                "before": -1,
            "after": -1
        }]
    })
     */
    function computeSubGraph(tile) {
        // instance.subGraphNodesCount = 0;
        //
        // var selectedTileIndex = getTileIndex(tile);
        // var aroundTilesBefore = tile.oldAroundTiles;
        // var aroundTilesAfter = tile.aroundTiles;
        //
        // var preSize = instance.subGraphData.length;
        // dfsGraph(selectedTileIndex);
        // if (preSize < instance.subGraphData.length) {
        //     updateGraphSize(preSize);
        // }
        // instance.subGraphNodesCount = 0;
        //
        // for (var i = 0; i < 4; i++) {
        //     if (aroundTilesBefore[i] >= 0) {
        //         preSize = instance.subGraphData.length;
        //         dfsGraph(aroundTilesBefore[i]);
        //         if (preSize < instance.subGraphData.length) {
        //             updateGraphSize(preSize);
        //         }
        //         instance.subGraphNodesCount = 0;
        //
        //         if (aroundTilesBefore[i] != aroundTilesAfter[i]) {
        //             var beHinted = (aroundTilesBefore[i] == Math.floor(tile.hintedLinks[i]));
        //             removeLink = generateLinksTags(selectedTileIndex, aroundTilesBefore[i], i, beHinted);
        //             removeLink.size = -tile.subGraphSize;
        //             removeLink.nodes = tile.nodesCount;
        //             instance.removeLinksData.push(removeLink);
        //         }
        //     }
        //     if (aroundTilesAfter[i] >= 0) { // useless
        //         preSize = instance.subGraphData.length;
        //         dfsGraph(aroundTilesAfter[i]);
        //         if (preSize < instance.subGraphData.length) {
        //             updateGraphSize(preSize);
        //         }
        //         instance.subGraphNodesCount = 0;
        //     }
        // }
        //
        // return true;
    }


    function computeGraphData() {
        // instance.subGraphData = instance.removeLinksData.concat(instance.subGraphData);
        // //console.log(instance.subGraphData);
        // instance.getHintsArray = new Array();
        // var edges = {};
        // for (var i = 0; i < instance.subGraphData.length; i++) {
        //     var linksData = instance.subGraphData[i];
        //     var xTile = instance.tiles[linksData.x];
        //     var yTile = instance.tiles[linksData.y];
        //     var key = linksData.x + linksData.tag + linksData.y;
        //     edges[key] = linksData;
        //     if (linksData.size < 0) {
        //         xTile.subGraphSize = 0;
        //         yTile.subGraphSize = 0;
        //         xTile.nodesCount = 1;
        //         yTile.nodesCount = 1;
        //     }
        //     else {
        //         xTile.subGraphSize = linksData.size;
        //         yTile.subGraphSize = linksData.size;
        //         xTile.nodesCount = linksData.nodes;
        //         yTile.nodesCount = linksData.nodes;
        //         if (!xTile.allAroundByTiles) {
        //             instance.getHintsArray[linksData.x] = true;
        //         }
        //         if (!yTile.allAroundByTiles) {
        //             instance.getHintsArray[linksData.y] = true;
        //         }
        //     }
        // }
        //
        // instance.maxSubGraphSize = 0;
        // for (var i = 0; i < instance.tiles.length; i++) {
        //     var tile = instance.tiles[i];
        //     if (tile.subGraphSize > instance.maxSubGraphSize) {
        //         instance.maxSubGraphSize = tile.subGraphSize;
        //     }
        // }
        //
        // if (instance.subGraphData.length > 0 || instance.hintsLog.sure_hints) {
        //     if(!instance.hintsShowing){
        //         instance.hintsLog = {};
        //     }
        //     var param = {
        //         player_name: player_name,
        //         round_id: roundID,
        //         time: time,
        //         edges: edges,
        //         is_hint: instance.hintsShowing && !instance.gameFinished,
        //         //logs: instance.hintsLog
        //     };
        //     instance.subGraphDataQueue.push(param);
        //     setTimeout(uploadGraphData, uploadDelayTime * 1000);
        // }
        // uploadGraphData();
        //
        // instance.dfsGraphLinksMap = new Array();
        // instance.subGraphData = new Array();
        // instance.removeLinksData = new Array();
    }

    function uploadGraphData() {
        // if(players_num == 1){
        //     instance.subGraphDataQueue.length = new Array();
        // }
        // if(instance.subGraphDataQueue.length == 0){
        //     return;
        // }
        //
        // if(instance.subGraphDataQueue_FIFO){
        //     for (var i = 0; i < instance.subGraphDataQueue.length - 1; i++) {
        //         var olderGraphData = instance.subGraphDataQueue[i];
        //         for (var j = i + 1; j < instance.subGraphDataQueue.length; j++) {
        //             var newerGraphData = instance.subGraphDataQueue[j];
        //             for (var key in olderGraphData.edges){
        //                 if (key in newerGraphData.edges){
        //                     olderGraphData.edges[key] = newerGraphData.edges[key];
        //                     delete newerGraphData.edges[key];
        //                 }
        //             }
        //         }
        //     }
        // }
        // else{
        //     var newestGraphData = instance.subGraphDataQueue[instance.subGraphDataQueue.length - 1];
        //     for (var i = 0; i < instance.subGraphDataQueue.length - 1; i++) {
        //         var olderGraphData = instance.subGraphDataQueue[i];
        //         for (var key in newestGraphData.edges){
        //             if (key in olderGraphData.edges){
        //                 delete olderGraphData.edges[key];
        //             }
        //         }
        //     }
        // }
        //
        // while (instance.subGraphDataQueue.length > 0) {
        //     var param = instance.subGraphDataQueue[0];
        //     if(instance.gameFinished || time - param.time >= uploadDelayTime){
        //         edges_count = Object.getOwnPropertyNames(param.edges).length;
        //         if(edges_count > 0){
        //             socket.emit("upload", param);
        //         }
        //         instance.subGraphDataQueue.shift();
        //     }
        //     else{
        //         break;
        //     }
        // }
    }

    function hideAllColorBorder() {
        for (var i = 0; i < instance.tiles.length; i++) {
            var tile = instance.tiles[i];
            if (tile.differentColor.length > 0) {
                tile.topEdge.visible = false;
                tile.rightEdge.visible = false;
                tile.bottomEdge.visible = false;
                tile.leftEdge.visible = false;
                tile.colorBorder.visible = false;
                tile.differentColor = new Array();
                tile.colorDirection = new Array();
            }
            tile.opacity = 1;
        }
    }

    function hideColorBorder(index) {
        var tile = instance.tiles[index];
        if (tile.differentColor.length > 0) {
            tile.topEdge.visible = false;
            tile.rightEdge.visible = false;
            tile.bottomEdge.visible = false;
            tile.leftEdge.visible = false;
            tile.colorBorder.visible = false;
        }
        for (var i = 0; i < instance.tiles.length; i++) {
            var tile = instance.tiles[i];
            if (tile.differentColor.length == 0) {
                tile.opacity = 1;
            }
        }
    }

    function setGradientStrockColor(path, color) {
        // path.strokeColor = {
        //     gradient: {
        //         stops: [[color, 0.7], ['white', 1]],
        //         radial: true
        //     },
        //     origin: path.position,
        //     destination: path.bounds
        // };
    }

    function showColorBorder(index, direction, colorIndex, pushToArray) {
        // var tile = instance.tiles[index];
        // switch (direction) {
        //     case 0:
        //         tile.topEdge.visible = true;
        //         setGradientStrockColor(tile.topEdge, instance.unsureHintsColor[colorIndex]);
        //         break;
        //     case 1:
        //         tile.rightEdge.visible = true;
        //         setGradientStrockColor(tile.rightEdge, instance.unsureHintsColor[colorIndex]);
        //         break;
        //     case 2:
        //         tile.bottomEdge.visible = true;
        //         setGradientStrockColor(tile.bottomEdge, instance.unsureHintsColor[colorIndex]);
        //         break;
        //     case 3:
        //         tile.leftEdge.visible = true;
        //         setGradientStrockColor(tile.leftEdge, instance.unsureHintsColor[colorIndex]);
        //         break;
        //     default:
        //         tile.colorBorder.visible = true;
        //         setGradientStrockColor(tile.colorBorder, instance.unsureHintsColor[colorIndex]);
        //         break;
        // }
        // if (pushToArray) {
        //     var repeated = false;
        //     for (var i = 0; i < tile.differentColor.length; i++) {
        //         if (tile.differentColor[i] == direction) {
        //             repeated = true;
        //         }
        //     }
        //     if (!repeated) {
        //         tile.differentColor.push(direction);
        //         tile.colorDirection.push(colorIndex);
        //     }
        // }
    }

    function normalizeTiles(forAskHelp) {
        // var leftUpPoint = new Point(10000, 10000);
        // var rightBottomPoint = new Point(-10000, -10000);
        // for (var i = 0; i < instance.tiles.length; i++) {
        //     var tile = instance.tiles[i];
        //     var position = tile.position;
        //     if (position.x < leftUpPoint.x) {
        //         leftUpPoint.x = position.x;
        //     }
        //     if (position.y < leftUpPoint.y) {
        //         leftUpPoint.y = position.y;
        //     }
        //     if (position.x > rightBottomPoint.x) {
        //         rightBottomPoint.x = position.x;
        //     }
        //     if (position.y > rightBottomPoint.y) {
        //         rightBottomPoint.y = position.y;
        //     }
        //
        //     var cellPosition = new Point(
        //         Math.round(position.x / instance.tileWidth),//returns int closest to arg
        //         Math.round(position.y / instance.tileWidth));
        //
        //     tile.position = cellPosition * instance.tileWidth; // round position(actual (x,y) in the canvas)
        //     tile.cellPosition = cellPosition; // cell position(in which grid the tile is)
        //
        //     tile.relativePosition = new Point(0, 0);
        //     tile.picking = false;
        //     tile.moved = false; // if one tile just clicked or actually moved(if moved, opacity=1)
        //     if (!forAskHelp) {
        //         tile.aroundTilesChanged = false;
        //     }
        //     tile.wantToMoveAway = -1;
        //     tile.positionMoved = false;
        // }
        // instance.centerPoint = (leftUpPoint + rightBottomPoint) / 2;
    }

    function checkHints(selectedTileIndex, dir, hintIndex) {
        // if (hintIndex < 0) {
        //     return;
        // }
        // totalHintsNum += 1;
        // var correctIndex = selectedTileIndex + directions[dir].x + directions[dir].y * instance.tilesPerRow;
        // if (hintIndex == correctIndex) {
        //     correctHintsNum += 1;
        // }
    }

    function computeHintedSubGraph() {
        // for (var i in instance.hintedTilesMap) {
        //     var tile = instance.tiles[i];
        //     refreshAroundTiles(tile, true);
        // }
        //
        // for (var i in instance.hintedTilesMap) {
        //     var tile = instance.tiles[i];
        //     if (tile.aroundTilesChanged) {
        //         computeSubGraph(tile);
        //     }
        // }
        //
        // computeGraphData();
        // instance.hintedTilesMap = new Array();
        // instance.hintsLog = {};
    }

    function getHints(round_id, selectedTileIndexes) {
        // var hintTileIndexes=new Array(-1,-1,-1,-1);
        // var currentStep = instance.steps;
        // var getHintsIndex = new Array();
        // for (var i = 0; i < instance.getHintsArray.length; i++) {
        //     if (instance.getHintsArray[i]) {
        //         getHintsIndex.push(i);
        //     }
        // }
        // if (getHintsIndex.length > 0 && players_num > 1) {
        //     //console.log(instance.getHintsArray, getHintsIndex);
        //     socket.emit("getHintsAround", {
        //         "round_id": round_id,
        //         "selectedTileIndexes": selectedTileIndexes,
        //         "indexes": getHintsIndex,
        //         "currentStep": currentStep,
        //     });
        // }
    }

    function focusOnTile(tile) {
        view.scrollBy(tile.position - view.center);
    }

    function processUnsureHints(unsureHints, indexes) {
        // if (!unsureHints) {
        //     return;
        // }
        // hideAllColorBorder();
        // var indexesMap = {};
        // if (indexes) {
        //     for (var i = 0; i < indexes.length; i++) {
        //         indexesMap[indexes[i]] = true;
        //     }
        // }
        // var colorIndex = 0;
        // for (var i = 0; i < unsureHints.length; i++) {
        //     if (unsureHints[i] && colorIndex < instance.unsureHintsColor.length) {
        //         var unsureHint = unsureHints[i];
        //         var index = unsureHint.index;
        //         if (!indexes || indexesMap[index]) {
        //             for (var d = 0; d < 4; d++) {
        //                 if (unsureHint.aroundTiles[d].length > 0 &&
        //                     instance.tiles[index].aroundTiles[d] < 0) {
        //                     showUnsureHintColor(index, unsureHint.aroundTiles[d], d, colorIndex);
        //                     if (colorIndex == 0) {
        //                         focusOnTile(instance.tiles[index]);
        //                     }
        //                     colorIndex += 1;
        //                     if (colorIndex >= instance.unsureHintsColor.length) {
        //                         break;
        //                     }
        //                 }
        //             }
        //         }
        //     }
        //     else {
        //         break;
        //     }
        // }
        // if (colorIndex > 0) {
        //     for (var i = 0; i < instance.tiles.length; i++) {
        //         var tile = instance.tiles[i];
        //         if (!tile.differentColor || tile.differentColor.length == 0) {
        //             tile.opacity = 0.25;
        //         }
        //     }
        // }
    }

    function countBidirectionLinks(sureHints) {
        // var bidirectionLinks = new Array();
        // for (var i = 0; i < sureHints.length; i++) {
        //     bidirectionLinks[i] = {
        //         count: 0,
        //         aroundTiles: [false, false, false, false]
        //     }
        //     for (var j = 0; j < 4; j++) {
        //         var oppositiveTileIndex = sureHints[i][j];
        //         if(oppositiveTileIndex != -1){
        //             var oppositiveEdge = oppositiveEdges[j];
        //             if(i == sureHints[oppositiveTileIndex][oppositiveEdge]){
        //                 bidirectionLinks[i].count += 1;
        //                 bidirectionLinks[i].aroundTiles[j] = true;
        //             }
        //         }
        //     }
        // }
        // return bidirectionLinks;
    }

    function showStrongAndWeakHints(sureHints, strongHintsNeededTiles) {
        // var shouldSave = false;
        // instance.conflictGroupHasBeenMoveAway = false;
        // var bidirectionLinks = countBidirectionLinks(sureHints);
        // var weakHintsNeededTiles = new Array();
        // while(strongHintsNeededTiles.length > 0){
        //     var index = strongHintsNeededTiles.shift();
        //     var tile = instance.tiles[index];
        //     for (var j = 0; j < 4; j++) {
        //         if(tile.aroundTiles[j] >= 0){
        //             continue;
        //         }
        //         var hintTileIndex = sureHints[index][j];
        //         if (hintTileIndex > -1) {
        //             var hintTile = instance.tiles[hintTileIndex];
        //             if(bidirectionLinks[index].aroundTiles[j] && hintTile.noAroundTiles){
        //                 var shouldSaveThis = showHints(index, sureHints[index], j);
        //                 normalizeTiles(true);
        //                 shouldSave = shouldSave || shouldSaveThis;
        //                 if(tile.aroundTiles[j] >= 0){
        //                     strongHintsNeededTiles.push(hintTileIndex);
        //                 }
        //             }
        //             else{
        //                 weakHintsNeededTiles.push(index);
        //             }
        //         }
        //     }
        // }
        //
        // for (var i = 0; i < weakHintsNeededTiles.length; i++) {
        //     var index = weakHintsNeededTiles[i];
        //     var tile = instance.tiles[index];
        //     for (var j = 0; j < 4; j++) {
        //         if(tile.aroundTiles[j] >= 0){
        //             continue;
        //         }
        //         if (sureHints[index][j] > -1 && bidirectionLinks[index].aroundTiles[j]) {
        //             var shouldSaveThis = showHints(index, sureHints[index], j);
        //             normalizeTiles(true);
        //             shouldSave = shouldSave || shouldSaveThis;
        //         }
        //     }
        // }
        // return shouldSave;
    }

    //
    // socket.on("reactiveHints", function (data) {
    //     console.log("hints:", data);
    //     if (data.sureHints.length == 0) {
    //         return;
    //     }
    //     var currentStep = data.currentStep;
    //     if (!mousedowned && currentStep == instance.steps) {
    //         instance.hintsShowing = true;
    //
    //         instance.hintsLog = {
    //             type: 'reactive',
    //             hints: JSON.stringify(data.sureHints),
    //             log: new Array(),
    //         };
    //         instance.hintAroundTilesMap = data.sureHints;
    //
    //         var strongHintsNeededTiles = new Array();
    //         for (var i = 0; i < data.indexes.length; i++) {
    //             var index = data.indexes[i];
    //             var tile = instance.tiles[index];
    //             for (var j = 0; j < 4; j++) {
    //                 if (tile.aroundTiles[j] < 0 && data.sureHints[index][j] > -1) {
    //                     strongHintsNeededTiles.push(index);
    //                     break;
    //                 }
    //             }
    //         }
    //
    //         var shouldSave = showStrongAndWeakHints(data.sureHints, strongHintsNeededTiles);
    //
    //         if (shouldSave) {
    //             saveGame();
    //         }
    //
    //         computeHintedSubGraph();
    //         normalizeTiles();
    //
    //         // judge the hint tiles
    //         if (!instance.gameFinished) {
    //             var errors = checkTiles();
    //             if (errors == 0) {
    //                 finishGame();
    //             }
    //         }
    //
    //         if (!shouldSave){
    //             processUnsureHints(data.unsureHints, data.selectedTileIndexes);
    //         }
    //
    //         instance.hintsShowing = false;
    //     }
    // });

    function moveSelectedTilesAway(selectedTileIndex) {
        // if(instance.conflictGroupHasBeenMoveAway){
        //     return false;
        // }
        // instance.conflictGroupHasBeenMoveAway = true;
        //
        // var selectedTile = instance.tiles[selectedTileIndex];
        //
        // if(selectedTile.nodesCount > tilesPerRow * tilesPerColumn / 2){
        //     return false;
        // }
        //
        // var groupTiles = new Array();
        //
        // DFSTiles(selectedTile, groupTiles, new Point(0, 0));
        //
        // var leftUpPoint = new Point(10000, 10000);
        // var rightBottomPoint = new Point(-10000, -10000);
        // for (var i = 0; i < groupTiles.length; i++) {
        //     var tile = groupTiles[i];
        //     var position = tile.position;
        //     if (position.x < leftUpPoint.x) {
        //         leftUpPoint.x = position.x;
        //     }
        //     if (position.y < leftUpPoint.y) {
        //         leftUpPoint.y = position.y;
        //     }
        //     if (position.x > rightBottomPoint.x) {
        //         rightBottomPoint.x = position.x;
        //     }
        //     if (position.y > rightBottomPoint.y) {
        //         rightBottomPoint.y = position.y;
        //     }
        // }
        // var groupCenterPoint = (leftUpPoint + rightBottomPoint)/2;
        //
        // var moveDir = groupCenterPoint - instance.centerPoint;
        // if(moveDir.x != 0){
        //     moveDir.x = moveDir.x > 0 ? 1: -1;
        // }
        // if(moveDir.y != 0){
        //     moveDir.y = moveDir.y > 0 ? 1: -1;
        // }
        //
        // var centerCellPosition = new Point(
        //     Math.round(groupCenterPoint.x / instance.tileWidth),//returns int closest to arg
        //     Math.round(groupCenterPoint.y / instance.tileWidth));
        // var destination = centerCellPosition + moveDir * (tilesPerRow / 2);
        //
        // for (var i = 0; i < groupTiles.length; i++) {
        //     groupTiles[i].picking = true;
        // }
        //
        // var hasConflicts = checkConflict(groupTiles, destination);
        // var hasConflict = hasConflicts[0];
        // var shouldSave = false;
        // if (!hasConflict) {
        //     for (var i = 0; i < groupTiles.length; i++) {
        //         var tile = groupTiles[i];
        //         placeTile(tile, destination + tile.relativePosition);
        //         shouldSave = shouldSave || tile.positionMoved;
        //         tile.relativePosition = new Point(0, 0);
        //         tile.picking = false;
        //     }
        //     if(shouldSave){
        //         console.log("success move away", moveDir);
        //         focusOnTile(selectedTile);
        //     }
        //     return shouldSave;
        // }
        //
        // for (var i = 0; i < groupTiles.length; i++) {
        //     groupTiles[i].picking = false;
        // }
        // return shouldSave;
    }

    function showHints(selectedTileIndex, hintTiles, direction) {
        // var tile = instance.tiles[selectedTileIndex];
        // var selectedGroupTiles = new Array();
        // DFSTiles(tile, selectedGroupTiles, new Point(0, 0));
        //
        // var shouldSave = false;
        //
        // var cellPosition = tile.cellPosition;
        //
        // if (!hintTiles) {
        //     return;
        // }
        //
        // var hintTilesCount = 0;
        // for (var j = 0; j < hintTiles.length; j++) {
        //     if(direction >= 0 && j != direction){
        //         continue;
        //     }
        //
        //     var correctTileIndex = hintTiles[j];
        //     if (correctTileIndex < 0) {
        //         instance.hintsLog.log.push({
        //             tile: selectedTileIndex,
        //             hint_tile: correctTileIndex,
        //             direction: j,
        //             success: false,
        //             msg: 'hint_tile no exists'
        //         });
        //         continue;
        //     }
        //
        //     if (tile.aroundTiles && tile.aroundTiles[j] >= 0) {
        //         instance.hintsLog.log.push({
        //             tile: selectedTileIndex,
        //             hint_tile: correctTileIndex,
        //             direction: j,
        //             success: false,
        //             msg: 'tile already has aroundTile in direction ' + j
        //         });
        //         continue;
        //     }
        //
        //
        //     if (tile.conflictTiles[correctTileIndex]) {
        //         instance.hintsLog.log.push({
        //             tile: selectedTileIndex,
        //             hint_tile: correctTileIndex,
        //             direction: j,
        //             success: false,
        //             msg: 'hint_tile was remove by player before'
        //         });
        //         continue;
        //     }
        //
        //     var correctTile = instance.tiles[correctTileIndex];
        //
        //     if (correctTile.picking) {
        //         instance.hintsLog.log.push({
        //             tile: selectedTileIndex,
        //             hint_tile: correctTileIndex,
        //             direction: j,
        //             success: false,
        //             msg: 'hint_tile is picking by player'
        //         });
        //         continue;
        //     }
        //
        //     var correctCellposition = cellPosition + directions[j];
        //
        //     var groupTiles = new Array();
        //
        //     DFSTiles(correctTile, groupTiles, new Point(0, 0));
        //
        //
        //     var sameGroup = false;
        //     for (var i = 0; i < groupTiles.length; i++) {
        //         if (getTileIndex(groupTiles[i]) == selectedTileIndex) {
        //             sameGroup = true;
        //             break;
        //         }
        //     }
        //
        //     if (sameGroup) {
        //         if (correctTile.allLinksHinted) {
        //             groupTiles = new Array();
        //             groupTiles.push(correctTile);
        //         }
        //         else {
        //             instance.hintsLog.log.push({
        //                 tile: selectedTileIndex,
        //                 hint_tile: correctTileIndex,
        //                 direction: j,
        //                 success: false,
        //                 msg: 'tile and hint_tile are in the same group'
        //             });
        //             continue;
        //         }
        //     }
        //
        //     for (var i = 0; i < groupTiles.length; i++) {
        //         groupTiles[i].picking = true;
        //     }
        //
        //     var hasConflicts = checkConflict(groupTiles, correctCellposition, selectedGroupTiles);
        //     var hasConflict = hasConflicts[0];
        //     var needToMove = hasConflicts[1];
        //     if(hasConflict && needToMove){
        //         var moveAwayShouldSave = moveSelectedTilesAway(selectedTileIndex);
        //         shouldSave = shouldSave || moveAwayShouldSave;
        //         cellPosition = instance.tiles[selectedTileIndex].cellPosition;
        //         correctCellposition = cellPosition + directions[j];
        //         hasConflicts = checkConflict(groupTiles, correctCellposition, selectedGroupTiles);
        //         hasConflict = hasConflicts[0];
        //         needToMove = hasConflicts[1];
        //     }
        //     if (hasConflict && correctTile.allLinksHinted) {
        //         for (var i = 0; i < groupTiles.length; i++) {
        //             groupTiles[i].picking = false;
        //         }
        //
        //         groupTiles = new Array();
        //         groupTiles.push(correctTile);
        //         for (var i = 0; i < groupTiles.length; i++) {
        //             groupTiles[i].picking = true;
        //         }
        //         hasConflicts = checkConflict(groupTiles, correctCellposition);
        //         hasConflict = hasConflicts[0];
        //         needToMove = hasConflicts[1];
        //     }
        //
        //     if (!hasConflict) {
        //         checkHints(selectedTileIndex, j, correctTileIndex);
        //
        //         for (var i = 0; i < groupTiles.length; i++) {
        //             var hintTile = groupTiles[i];
        //             placeTile(hintTile, correctCellposition + hintTile.relativePosition);
        //             if (hintTile.positionMoved) {
        //                 instance.hintedTilesMap[getTileIndex(hintTile)] = true;
        //             }
        //             shouldSave = shouldSave || hintTile.positionMoved;
        //             hintTile.relativePosition = new Point(0, 0);
        //             hintTile.alreadyHinted = true;
        //             hintTile.picking = false;
        //             //console.log("put", hintTile.name, "in position", hintTile.cellPosition, hintTile.positionMoved);
        //         }
        //
        //         for (var i = 0; i < groupTiles.length; i++) {
        //             var hintTile = groupTiles[i];
        //             refreshAroundTiles(hintTile, true);
        //             hintTile.picking = false;
        //         }
        //         instance.hintsLog.log.push({
        //             tile: selectedTileIndex,
        //             hint_tile: correctTileIndex,
        //             direction: j,
        //             success: true,
        //             msg: "recomment " + groupTiles.length + " tiles"
        //         });
        //
        //         hintTilesCount += groupTiles.length;
        //     }
        // }
        // if (hintTilesCount) {
        //     tile.alreadyHinted = true;
        // }
        //
        // return moveAwayShouldSave;
    }

    function getTileAtCellPosition(cellPosition) {
        // var roundPosition = cellPosition * instance.tileWidth;
        // var retTile = undefined;
        // var hitResults = project.hitTestAll(roundPosition);
        // for (var i = 0; i < hitResults.length; i++) {
        //     var hitResult = hitResults[i];
        //     if (hitResult.type != "pixel") {
        //         continue;
        //     }
        //     var img = hitResult.item;
        //     var tile = img.parent.parent;
        //     if (!tile.picking) {
        //         retTile = tile;
        //     }
        // }
        // return retTile;
    }

    this.animation = function () {
        var changeOpacity = function (path) {
            var speed = 0.005;
            var upperBound = 0.7;
            var lowwerBound = 0.1;
            if (path.reverse) {
                path.opacity += speed;
                if (path.opacity >= upperBound) {
                    path.reverse = false;
                }
            }
            else {
                path.opacity -= speed;
                if (path.opacity <= lowwerBound) {
                    path.reverse = true;
                }
            }
        }

        // for (var i = 0; i < instance.tiles.length; i++) {
        //     var tile = instance.tiles[i];
        //     if (tile.differentColor.length > 0) {
        //         for (var j = 0; j < tile.differentColor.length; j++) {
        //             var edgeIndex = tile.differentColor[j];
        //             switch (edgeIndex) {
        //                 case 0:
        //                     //tile.topEdge.strokeColor.hue += 1;
        //                     changeOpacity(tile.topEdge);
        //                     break;
        //                 case 1:
        //                     //tile.rightEdge.strokeColor.hue += 1;
        //                     changeOpacity(tile.rightEdge);
        //                     break;
        //                 case 2:
        //                     //tile.bottomEdge.strokeColor.hue += 1;
        //                     changeOpacity(tile.bottomEdge);
        //                     break;
        //                 case 3:
        //                     //tile.leftEdge.strokeColor.hue += 1;
        //                     changeOpacity(tile.leftEdge);
        //                     break;
        //                 default:
        //                     //tile.colorBorder.strokeColor.hue += 1;
        //                     changeOpacity(tile.colorBorder);
        //                     break;
        //             }
        //         }
        //     }
        // }
    }

    this.dragTile = function (delta) {
        if (instance.draging) {
            if (instance.selectedTile[0].differentColor.length > 0) {
                hideColorBorder(getTileIndex(instance.selectedTile[0]));
            }
            else {
                hideAllColorBorder();
            }
            var tile = instance.selectedTile[0];
            tile.opacity = 1;
            tile.position = tile.position + delta;
        }
        else {
            var currentScroll = view.currentScroll - delta * instance.currentZoom;
            view.scrollBy(currentScroll);
            view.currentScroll = currentScroll;
        }
    }

    function DFSTiles(tile, array, relativePosition) {
        // for (var i = 0; i < array.length; i++) {
        //     if (array[i] == tile)
        //         return;
        // }
        // tile.relativePosition = relativePosition;
        // tile.originPosition = tile.cellPosition;
        // array.push(tile);
        // for (var i = 0; i < 4; i++) {
        //     var newTileIndex = tile.aroundTiles[i];
        //     if (newTileIndex >= 0) {
        //         var newTile = instance.tiles[newTileIndex];
        //         DFSTiles(newTile, array, relativePosition + directions[i]);
        //     }
        // }
    }

    function findSelectTile(point) {
        console.log("point",point);
        var xPosition = Math.floor((point.x - instance.candidateAreaPosition.x)/instance.tileWidth);
        var yPosition = Math.floor((point.y - instance.candidateAreaPosition.y)/instance.tileWidth);
        var xPosition2 = Math.floor((point.x - instance.playerAreaPosition.x)/instance.tileWidth);
        var yPosition2 = Math.floor((point.y - instance.playerAreaPosition.y)/instance.tileWidth);
        console.log("point:",point);
        console.log("playerAreaPosition",instance.playerAreaPosition);
        console.log("x,y2",xPosition2,yPosition2);
        if(xPosition>=0 && xPosition<=instance.tilesPerRow && yPosition>=0 && yPosition<=instance.tilesPerColumn && instance.candidateAreaArray[yPosition*instance.tilesPerRow+xPosition]) {
            console.log("hit candidate");
            tile = instance.candidateAreaArray[yPosition * instance.tilesPerRow + xPosition];
            instance.selectedTile = new Array();
            instance.selectedTile.push(tile);
        }
        else if (xPosition2>=0 && xPosition2<=instance.tilesPerRow && yPosition2>=0 && yPosition2<=instance.tilesPerColumn && instance.playerAreaArray[yPosition2 * instance.tilesPerRow + xPosition2]) {
            console.log("hit player");
            tile = instance.playerAreaArray[yPosition2 * instance.tilesPerRow + xPosition2];
            instance.selectedTile = new Array();
            instance.selectedTile.push(tile);
            }
        else
            instance.selectedTile = null;
        console.log("find select tile",instance.selectedTile);
        // var cellPosition = new Point(
        //     Math.round(point.x / instance.tileWidth),//returns int closest to arg
        //     Math.round(point.y / instance.tileWidth));
        // var hitResult = project.hitTest(point);
        // if (!hitResult || hitResult.type != "pixel") {
        //     instance.selectedTile = null;
        //     return;
        // }
        // var img = hitResult.item;
        // var tile = img.parent.parent;
        // // console.log(tile.name);
        // if (tile.picking) {
        //     instance.selectedTile = null;
        //     return;
        // }
        // if (tile && tile.name) {
        //     instance.selectedTile = new Array();
        //     if (instance.dragMode == "tile-First") {
        //         instance.selectedTile.push(tile);
        //     }
        //     else {
        //         DFSTiles(tile, instance.selectedTile, new Point(0, 0));
        //     }
        // }
        // else {
        //     instance.selectedTile = null;
        // }
    }

    this.dragTileOrTiles = function () {
        if (instance.dragMode == "tile-First") {
            instance.dragDFSTile();
        }
        else {
            instance.dragOnlyTile();
        }
    }

    this.dragOnlyTile = function () {
        if (instance.selectedTile) {
            for (var i = 1; i < instance.selectedTile.length; i++) {
                instance.selectedTile[i].opacity = 0.5;
                instance.selectedTile[i].picking = false;
            }
            var tile = instance.selectedTile[0];
            instance.selectedTile = new Array();
            instance.selectedTile.push(tile);
        }
    }

    this.dragDFSTile = function () {
        if (instance.selectedTile) {
            var tile = instance.selectedTile[0];
            instance.selectedTile = new Array();
            DFSTiles(tile, instance.selectedTile, new Point(0, 0));
            for (var i = 0; i < instance.selectedTile.length; i++) {
                instance.selectedTile[i].opacity = 0.5;
                instance.selectedTile[i].picking = instance.selectedTile[0].picking;
            }
        }
    }

    this.zoom = function (zoomDelta) {
        var newZoom = instance.currentZoom + zoomDelta;
        if (newZoom >= 0.2 && newZoom <= 5) {
            view.zoom = instance.currentZoom = newZoom;
        }
    }

    function checkTiles() {
        // var errors = 0;
        // var firstTile = instance.tiles[0];
        // var firstCellPosition = firstTile.cellPosition;
        //
        // for (var y = 0; y < instance.tilesPerColumn; y++) {
        //     for (var x = 0; x < instance.tilesPerRow; x++) {
        //         var index = y * instance.tilesPerRow + x;
        //         var cellPosition = instance.tiles[index].cellPosition;
        //
        //         if (cellPosition != firstCellPosition + new Point(x, y)) {
        //             errors++;
        //         }
        //     }
        // }
        //
        // return errors;
    }

    this.showLastResult = function () {
        var visible = instance.puzzleImage.visible;
        for (var i = 0; i < instance.tiles.length; i++) {
            instance.tiles[i].visible = visible;
        }
        instance.puzzleImage.visible = !visible;
    }

    function saveGame() {
        // var tilePositions = new Array();
        // var tileHintedLinks = new Array();
        // for (var i = 0; i < instance.tiles.length; i++) {
        //     var tile = instance.tiles[i];
        //     var tilePos = {
        //         index: i,
        //         subGraphSize: tile.subGraphSize,
        //         nodesCount: tile.nodesCount,
        //         x: tile.cellPosition.x,
        //         y: tile.cellPosition.y,
        //     };
        //     tilePositions.push(tilePos);
        //     tileHintedLinks.push(tile.hintedLinks);
        // }
        //
        // socket.emit('saveGame', {
        //     round_id: roundID,
        //     player_name: player_name,
        //     steps: instance.steps,
        //     realSteps: instance.realSteps,
        //     startTime: startTime,
        //     maxSubGraphSize: instance.maxSubGraphSize,
        //     tiles: JSON.stringify(tilePositions),
        //     tileHintedLinks: JSON.stringify(tileHintedLinks),
        //     totalHintsNum: totalHintsNum,
        //     correctHintsNum: correctHintsNum
        // });
    }

    function drawArea(candidateAreaPosition, playerAreaPosition, tilesPerRow, tilesPerColum, tileWidth) {
        for (var i = 0; i <= tilesPerColum; ++i) {
            var myPath = new Path();
            myPath.strokeColor = 'black';
            myPath.add(candidateAreaPosition + new Point(0, i * tileWidth));
            myPath.add(candidateAreaPosition + new Point(tilesPerRow * tileWidth, i * tileWidth));
        }
        for (var j = 0; j <= tilesPerRow; ++j) {
            var myPath = new Path();
            myPath.strokeColor = 'black';
            myPath.add(candidateAreaPosition + new Point(j * tileWidth, 0));
            myPath.add(candidateAreaPosition + new Point(j * tileWidth, tilesPerColum * tileWidth));
        }
        console.log("candidateAreaPosition", candidateAreaPosition);
        console.log("playerAreaPosition", playerAreaPosition);
        for (var i = 0; i <= tilesPerColum; ++i) {
            var myPath = new Path();
            myPath.strokeColor = 'black';
            myPath.add(playerAreaPosition + new Point(0, i * tileWidth));
            myPath.add(playerAreaPosition + new Point(tilesPerRow * tileWidth, i * tileWidth));
        }
        for (var j = 0; j <= tilesPerRow; ++j) {
            var myPath = new Path();
            myPath.strokeColor = 'black';
            myPath.add(playerAreaPosition + new Point(j * tileWidth, 0));
            myPath.add(playerAreaPosition + new Point(j * tileWidth, tilesPerColum * tileWidth));
        }


    }

    socket.on('loadGameSuccess', function (data) {
        if (data.username == player_name) {
            drawArea(instance.candidateAreaPosition, instance.playerAreaPosition, instance.tilesPerRow, instance.tilesPerColumn, instance.tileWidth);
            if (!data.gameData) {
                createAndPlaceTiles(true);
                return;
            }
            // var gameData = data.gameData;
            // var needIntro = !gameData.round_id;
            // if (gameData.round_id == roundID) {
            //     $.amaran({
            //         'title': 'loadGame',
            //         'message': 'Progress loaded.',
            //         'inEffect': 'slideRight',
            //         'cssanimationOut': 'zoomOutUp',
            //         'position': "top right",
            //         'delay': 2000,
            //         'closeOnClick': true,
            //         'closeButton': true
            //     });
            //     startTime = gameData.startTime;
            //     instance.maxSubGraphSize = gameData.maxSubGraphSize;
            //     instance.steps = gameData.steps;
            //     instance.realSteps = gameData.realSteps;
            //     document.getElementById("steps").innerHTML = instance.realSteps;
            //     instance.saveTilePositions = JSON.parse(gameData.tiles);
            //     instance.saveHintedLinks = JSON.parse(gameData.tileHintedLinks);
            //     totalHintsNum = gameData.totalHintsNum;
            //     correctHintsNum = gameData.correctHintsNum;
            // }
            createAndPlaceTiles(true);
        }
    });

    function loadGame() {
        socket.emit('loadGame', {username: player_name});
    }

    function getTileInfo(imgSrc) {
        var id = imgSrc.substring(11).split('_')[0];
        console.log('id:',id);
        var result;
        switch (id){
            case '1':
                result= [[0,3,4,5],[7,9,8,0],[8,5,5,9],[0,5,0,1],
                    [4,7,1,8],[1,1,8,3],[0,0,7,9],[8,1,0,3],
                    [7,8,9,5],[9,0,9,8],[8,6,7,5],[1,9,9,7],
                    [3,5,7,1],[9,3,8,0],[2,1,1,3],[1,3,2,0]];
                break;
            case '2':
                result = [
                [8,0,9,5],[0,3,8,7],[3,5,1,9],[5,2,3,1],[4,5,8,1],
                [8,5,0,5],[9,2,9,0],[0,0,0,7],[0,7,6,0],[1,1,2,2],
                [9,0,0,7],[2,2,0,0],[3,7,5,2],[9,9,9,5],[6,4,9,0],
                [0,6,3,4],[0,5,2,2],[9,1,7,8],[9,7,1,3],[9,3,0,7],
                [8,7,3,0],[7,0,9,5],[1,0,9,2],[2,5,9,3],[4,6,8,5]
                ];
                break;
            case '3':
                result = [
                    [4,0,4,2],[4,3,4,3],[1,1,0,0],[2,0,1,0],[2,4,9,1],[4,2,5,1],
                    [9,1,2,3],[5,1,1,4],[3,5,3,2],[0,7,4,8],[8,2,8,1],[3,0,0,1],
                    [0,0,3,6],[6,7,5,6],[1,6,6,5],[0,4,8,5],[8,2,3,2],[4,1,1,5],
                    [0,6,8,1],[3,1,4,8],[6,7,4,7],[9,8,6,3],[4,4,5,8],[6,2,9,9],
                    [5,8,9,0],[4,8,2,0],[9,1,4,5],[9,8,8,4],[1,3,8,6],[0,5,9,7],
                    [8,6,2,2],[9,0,8,1],[1,8,0,7],[9,5,0,8],[0,9,4,7],[8,7,4,4]
                ];
                break;
        }
        return result;

    }
}



/**
 * Game Finish
 */
(function () {
    if(players_num == 1){
        $('.rating-body').css('display', 'none');
    }
    else{
        $('#apply-button').attr('disabled',"true");
        $('#submit-button').attr('disabled',"true");
        $('.rb-rating').rating({
            'showCaption': false,
            'showClear': false,
            'stars': '5',
            'min': '0',
            'max': '5',
            'step': '0.5',
            'size': 'xs',
            // 'starCaptions': { 0: 'NO', 1: 'Too Bad', 2: 'Little Help', 3: 'Just So So', 4: 'Great Help', 5: 'Excellent!' }
        });
        $('.rb-rating').change(function (event){
            $('#apply-button').removeAttr("disabled");
            $('#submit-button').removeAttr("disabled");
        })
    }
    $('#submit-button').click(function (event) {
        // player's rating for the hint(what he thinks about the function)
        var rating = $("#rating2").val();

        sendRecord(true, rating);
        quitRound(roundID);
    });

    $('#quit').click(function (event) {
        if(puzzle.forceLeaving){
            return;
        }
        $('#quitLabel').text('Are You Sure to Quit?');
        $('#ensure_quit_dialog').modal({
            keyboard: true
        });
    });

    $('#apply-button').click(function (event) {
        var rating = $("#rating").val();
        //puzzle.calcHintedTile();

        sendRecord(false, rating);
        quitRound(roundID);
    });
}());

$('#undo_button').on('click', function (event) {
    // if (puzzle.steps != undoStep) {
    //     puzzle.undoNextStep();
    // }
    puzzle.undoNextStep();
});

$('#undo_button').mousedown(function () {
    $('#undo_button').css("background-color", "rgba(200, 200, 200, 0.9)")
});

$('#undo_button').mouseup(function () {
    $('#undo_button').css("background-color", "rgba(200, 200, 200, 0)")
});

$('#undo_button').mouseover(function () {
    $('#undo_button').css("background-color", "rgba(200, 200, 200, 0.9)")
});

$('#undo_button').mouseout(function () {
    $('#undo_button').css("background-color", "rgba(200, 200, 200, 0)")
});

$('.returnCenter').click(function () {
    puzzle.focusToCenter();
});

$('#check_button').on('click',function (event) {
    var result = puzzle.checkSquare();
    if(result[0]){
        var firsti = result[1];
        var firstj = result[2];
        var size = result[3];
        puzzle.uploadUserGraph(firsti,firstj,size);
    }
    else{
        console.log("not valid",result);
    }
});

$('#hint_button_2').on('click',function (event) {
    puzzle.getHint(2);
});
$('#hint_button_3').on('click',function (event) {
    puzzle.getHint(3);
});
$('#hint_button_4').on('click',function (event) {
    puzzle.getHint(4);
});
$('#hint_button_5').on('click',function (event) {
    puzzle.getHint(5);
});

/**
 * Send personal records to the server at the end of one game
 */
function sendRecord(finished, rating) {
    // var params = {
    //     round_id: roundID,
    //     player_name: player_name,
    //     finished: finished,
    //     steps: puzzle.realSteps,
    //     startTime: startTime,
    //     totalLinks: hintedLinksNum.totalLinks,
    //     hintedLinks: hintedLinksNum.hintedLinks,
    //     correctLinks: hintedLinksNum.correctLinks,
    //     totalHintsNum: totalHintsNum,
    //     correctHintsNum: correctHintsNum,
    //     rating: rating
    // };
    // socket.emit('saveRecord', params);
}

function quitRound(roundID) {
    if(players_num == 1){
        socket.emit('quitRound', {round_id:roundID, username: player_name});
    }
    else{
        var randomTime = Math.random() * 1000;
        $('#quitLabel').text('Quiting...');
        $('#msgLabel').text('Quiting...');
        $('.rating-body').css('display', 'none');
        $('#apply-button').attr('disabled',"true");
        $('#submit-button').attr('disabled',"true");
        $('#cancel-button').attr('disabled',"true");
        setTimeout(function(){ 
            socket.emit('quitRound', {round_id:roundID, username: player_name});
        }, randomTime);
    }
}

if(solved_players >= 1){
    puzzle.forceLeave('Someone Have Finished the Puzzle. Please Quit.');
}


$(document).ready(function(e) { 
    var counter = 0;
    if (window.history && window.history.pushState) {
        $(window).on('popstate', function () {
            window.history.pushState('forward', null, '#');
            window.history.forward(1);
            if(!puzzle.forceLeaving){
                $('#quitLabel').text('Are You Sure to Quit?');
                $('#ensure_quit_dialog').modal({
                    keyboard: true
                });
            }
        });
    }
 
    window.history.pushState('forward', null, '#'); //在IE中必须得有这两行
    window.history.forward(1);
});