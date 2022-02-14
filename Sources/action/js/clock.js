/**
 * Simple Clock with adjustable colors (heavily inspired by kirupa: https://www.kirupa.com/html5/create_an_analog_clock_using_the_canvas.htm)
 * @param {canvas} cnv an existing canvas element in the DOM
 * API:
 * - drawClock() -> draws the clock - would normally called every second
 * - getImageData() -> returns base64-encode string of the canvas
 * - setColors(jsonObj) -> set colors of the clock's components as JSON
 * 		{
 *			hour:	"#efefef",
 *			minute: "#cccccc",
 *			second: "#ff9933",
 *			stroke: "#cccccc",
 *			background: "#000000"
 *		}
 * - getColors() -> get current color values
 */

function Clock(cnv) {
    if(!cnv) return;
    var ctx = cnv.getContext('2d');
    var clockRadius = cnv.width / 2;
    var clockX = cnv.width / 2;
    var clockY = cnv.height / 2;
    var clockEnd = 3 * Math.PI / 2;
    var clockStart = -Math.PI / 2;
    var twopi = 2 * Math.PI;

    var colors = {};
    var currentPhase = "WORK";
    var expirationDate = null;
    var totalDuration = null;
    
    var blinkCounter = 0;

    resetColors();

    function resetColors() {
        setColors({
            hour: "#efefef",
            minute: "#cccccc",
            second: "#ff9933",
            stroke: "#cccccc",
            background: "#000000"
        });
    }

    function start(duration, phase) {
        var newDate = new Date()
        newDate.setSeconds(newDate.getSeconds() + duration)
        expirationDate = newDate
        totalDuration = duration
        this.currentPhase = phase
    }

    function stop() {
        expirationDate = null
        totalDuration = null
    }

    function remainingSeconds() {
        var now = new Date();
        return (expirationDate - now) / 1000;
    }

    function drawBlink() {
        ctx.fillStyle = blinkCounter % 2 == 0 ? 'white' : 'black';
        ctx.fillRect(0, 0, cnv.width, cnv.height);

        ctx.fillStyle = blinkCounter % 2 == 1 ? 'white' : 'black';
        ctx.font = "bold 20px arial";
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(this.currentPhase, clockX, clockY)
        ctx.fillText("OVER", clockX, clockY+20)

        blinkCounter += 1
        return 0
    }

    function drawNextPhasePreview(nextPhase) {
        if (colors.background == "transparent") {
            ctx.clearRect(0, 0, cnv.width, cnv.height);
        } else {
            ctx.fillStyle = colors.background;
            ctx.fillRect(0, 0, cnv.width, cnv.height);
        }
        
        ctx.beginPath();
        ctx.arc(clockX, clockY, 60, clockStart, clockEnd, false);
        ctx.lineWidth = 15;
        ctx.strokeStyle = colors.stroke;
        ctx.stroke();

        ctx.fillStyle = colors.stroke;
        ctx.font = "bold 20px arial";
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText("NEXT:", clockX, clockY-20)
        ctx.fillText(nextPhase, clockX, clockY)
    }

    function drawClock() {
        var seconds = remainingSeconds()

        if (colors.background == "transparent") {
            ctx.clearRect(0, 0, cnv.width, cnv.height);
        } else {
            ctx.fillStyle = colors.background;
            ctx.fillRect(0, 0, cnv.width, cnv.height);
        }

        ctx.beginPath();
        if (!totalDuration) {
            ctx.arc(clockX, clockY, 60, clockStart, clockEnd, false);
        } else {
            ctx.arc(clockX, clockY, 60, clockEnd - (twopi * seconds/totalDuration), clockStart, false);
        }
        ctx.lineWidth = 15;
        ctx.strokeStyle = colors.stroke;
        ctx.stroke();
        
        ctx.fillStyle = colors.stroke;
        ctx.font = "bold 20px arial";
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(this.currentPhase, clockX, clockY)

        return seconds >= 0 ? seconds : 0;
    }

    function setColors(jsnColors) {
        (typeof jsnColors === 'object') && Object.keys(jsnColors).map(c => colors[c] = jsnColors[c]);
    }

    function getColors() {
        return this.colors;
    }

    function getImageData() {
        return cnv.toDataURL();
    }

    return {
        drawClock: drawClock,
        getImageData: getImageData,
        setColors: setColors,
        getColors: getColors,
        colors: colors,
        resetColors: resetColors,
        start: start,
        stop: stop,
        remainingSeconds: remainingSeconds,
        drawBlink: drawBlink,
        currentPhase: currentPhase,
        drawNextPhasePreview: drawNextPhasePreview
    }
}
