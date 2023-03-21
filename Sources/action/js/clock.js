/**
 * Simple Clock with adjustable colors (inspired by kirupa: https://www.kirupa.com/html5/create_an_analog_clock_using_the_canvas.htm)
 * @param {canvas} canvas an existing canvas element in the DOM
 */

function Clock(canvas) {
    if(!canvas) return;
    var ctx = canvas.getContext('2d');
    var clockRadius = canvas.width / 2;
    var clockX = canvas.width / 2;
    var clockY = canvas.height / 2;
    var clockEnd = 3 * Math.PI / 2;
    var clockStart = -Math.PI / 2;
    var twopi = 2 * Math.PI;

    var colors = {};
    var currentPhase = "WORK";
    var expirationDate = null;
    var totalDuration = null;
    var savedRemainingSeconds = 0;
    
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
        currentPhase = phase
    }

    function stop() {
        expirationDate = null
        totalDuration = null
        savedRemainingSeconds = 0
    }

    function pause() {
        savedRemainingSeconds = remainingSeconds()
    }

    function unpause() {
        var newDate = new Date()
        newDate.setSeconds(newDate.getSeconds() + savedRemainingSeconds)
        expirationDate = newDate
        savedRemainingSeconds = 0
    }

    function remainingSeconds() {
        if (savedRemainingSeconds > 0) {
            return savedRemainingSeconds
        } else {
            var now = new Date();
            return (expirationDate - now) / 1000;
        }
    }

    function drawBlink() {
        // Blinking state alternates between background and stroke color, nominally every 1s
        ctx.fillStyle = blinkCounter % 2 == 0 ? colors.stroke : (colors.background == 'transparent' ? '#000000' : colors.background);
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        var color = blinkCounter % 2 == 1 ? colors.stroke : (colors.background == 'transparent' ? '#000000' : colors.background)
        drawWords(null, currentPhase, "OVER", color)

        blinkCounter += 1
        return 0
    }

    function drawNextPhasePreview(nextPhase) {
        if (colors.background == "transparent") {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = colors.background;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.beginPath();
        ctx.arc(clockX, clockY, 60, clockStart, clockEnd, false);
        ctx.lineWidth = 15;
        ctx.strokeStyle = colors.stroke;
        ctx.stroke();

        drawWords("NEXT:", nextPhase, null)
    }

    function drawClock() {
        var seconds = remainingSeconds()

        if (colors.background == "transparent") {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = colors.background;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
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
        
        drawWords(savedRemainingSeconds > 0 ? "PAUSE": null, currentPhase, null)

        return seconds >= 0 ? seconds : 0;
    }

    function drawWords(prefix, phase, suffix, fillOverride) {
        ctx.fillStyle = fillOverride || colors.stroke;
        ctx.font = "bold 20px arial";
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        if (prefix) {
            ctx.fillText(prefix, clockX, clockY-20)
        }

        if (phase.indexOf('_') > 0) {
            const parts = phase.split('_')
            if (suffix) {
                ctx.fillText(parts[0], clockX, clockY-20)
                ctx.fillText(parts[1], clockX, clockY)
                ctx.fillText(suffix, clockX, clockY+20)
            } else {
                ctx.fillText(parts[0], clockX, clockY)
                ctx.fillText(parts[1], clockX, clockY+20)
            }
        } else {
            ctx.fillText(phase, clockX, clockY)
            if (suffix) {
                ctx.fillText(suffix, clockX, clockY+20)
            }
        }
    }

    function setColors(jsnColors) {
        (typeof jsnColors === 'object') && Object.keys(jsnColors).map(c => colors[c] = jsnColors[c]);
    }

    function getImageData() {
        return canvas.toDataURL();
    }

    function setOrientation(orientation) {
        if (orientation === 'bottom') {
            clockEnd = Math.PI / 2;
            clockStart = -3 * Math.PI / 2;
        } else {
            clockEnd = 3 * Math.PI / 2;
            clockStart = -Math.PI / 2;
        }
    }

    return {
        drawClock: drawClock,
        getImageData: getImageData,
        setColors: setColors,
        colors: colors,
        resetColors: resetColors,
        start: start,
        stop: stop,
        remainingSeconds: remainingSeconds,
        drawBlink: drawBlink,
        currentPhase: currentPhase,
        drawNextPhasePreview: drawNextPhasePreview,
        pause: pause,
        unpause: unpause,
        setOrientation: setOrientation
    }
}
