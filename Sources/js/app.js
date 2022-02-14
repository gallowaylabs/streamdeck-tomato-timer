/* global $SD */
$SD.on('connected', conn => connected(conn));

function connected(jsn) {
    debugLog('Connected Plugin:', jsn);

    /** subscribe to the willAppear event */
    $SD.on('com.gallowaylabs.tomato.clock.willAppear', jsonObj =>
        action.onWillAppear(jsonObj)
    );
    $SD.on('com.gallowaylabs.tomato.clock.didReceiveSettings', jsonObj =>
        action.onDidReceiveSettings(jsonObj)
    );
    $SD.on('com.gallowaylabs.tomato.clock.willDisappear', jsonObj =>
        action.onWillDisappear(jsonObj)
    );
    $SD.on('com.gallowaylabs.tomato.clock.keyDown', jsonObj =>
        action.onKeyDown(jsonObj)
    );
    $SD.on('com.gallowaylabs.tomato.clock.keyUp', jsonObj =>
        action.onKeyUp(jsonObj)
    );
}

var action = {
    type: 'com.gallowaylabs.tomato.clock',
    cache: {},

    onDidReceiveSettings: function(jsn) {
        console.log("onDidReceiveSettings", jsn);
        const settings = jsn.payload.settings;
        const clock = this.cache[jsn.context];
        if(!settings || !clock) return;

        if (settings.hasOwnProperty('clock_index')) { /* if there's no clock-definitions, so simply do nothing */
            /* set the appropriate clockface index as choosen from the popupmenu in PI */
            if (clock) {
                clock.setClockFaceNum(Number(settings.clock_index));
                this.cache[jsn.context] = clock;
            }
        }
        if (settings.hasOwnProperty('alarm_sound')) { /* if there's no clock-definitions, so simply do nothing */
            if (clock) {
                clock.setAlarmNum(Number(settings.alarm_sound));
            }
        }
        if (settings.hasOwnProperty('clock_type')) {
            if (clock) {
                clock.setClockType(settings.clock_type);
            }
        }
        if (settings.hasOwnProperty('work_time')) {
            if (clock) {
                clock.setWorkTime(parseInt(settings.work_time) * 60)
            }
        }
        if (settings.hasOwnProperty('short_break_time')) { 
            if (clock) {
                clock.setShortBreakTime(parseInt(settings.short_break_time) * 60)
            }
        }
        if (settings.hasOwnProperty('long_break_time')) { 
            if (clock) {
                clock.setLongBreakTime(parseInt(settings.long_break_time) * 60)
            }
        }
        if (settings.hasOwnProperty('disable_blink')) { 
            if (clock) {
                clock.setBlinkDisabled(settings.disable_blink)
            }
        }

    },

    onWillAppear: function(jsn) {

        if(!jsn.payload || !jsn.payload.hasOwnProperty('settings')) return;

        console.log('onWillAppear', jsn.payload.settings);

        const clock = new TomatoTimer(jsn);
        // cache the current clock
        this.cache[jsn.context] = clock;
        this.onDidReceiveSettings(jsn);

    },

    onWillDisappear: function(jsn) {
        let found = this.cache[jsn.context];
        if(found) {
            // remove the clock from the cache
            found.destroyClock();
            delete this.cache[jsn.context];
        }
    },

    onKeyDown: function(jsn) {
        const clock = this.cache[jsn.context];
        /** Edge case +++ */
        if(!clock) this.onWillAppear(jsn);
        else clock.checkButtonHeld();
    },

    onKeyUp: function(jsn) {
        const clock = this.cache[jsn.context];
        /** Edge case +++ */
        if(!clock) this.onWillAppear(jsn);
        else clock.buttonPressed();
    }

};

function TomatoTimer(jsonObj) {
    var jsn = jsonObj,
        context = jsonObj.context,
        clock = null,
        clockTimer = 0,
        clockface = clockfaces[0],
        currentClockFaceIdx = 0,
        origContext = jsonObj.context,
        canvas = null,
        cycleCounter = 0,
        phase = 'WORK',
        nextPhase = 'BREAK'
        running = false,
        blinking = false,
        audioElement = null,
        workTime = 25 * 60,
        shortBreakTime = 5 * 60,
        longBreakTime = 10 * 60,
        alarmFileName = null,
        audioElement = null,
        buttonDown = false,
        skipNextKeyUp = false,
        blinkDisabled = false;
        
    function createClock(settings) {
        canvas = document.createElement('canvas');
        canvas.width = 144;
        canvas.height = 144;
        clock = new Clock(canvas);
        clock.setColors(clockface.colors);
        drawClock()
    }

    function checkButtonHeld() {
        buttonDown = true
        setTimeout(function() {
            if (buttonDown) {
                reset()
            }
        }, 1750)
    }

    function buttonPressed() {
        buttonDown = false;
        if (skipNextKeyUp) {
            skipNextKeyUp = false
            return
        }

        if (blinking) {
            blinking = false;
            window.clearInterval(clockTimer);
            clockTimer = 0;
            audioElement.pause()
            drawNextPhasePreview()
            return;
        }

        if (!running) {
            if (phase == 'WORK') {
                clock.start(this.workTime, phase)
                nextPhase = 'BREAK'
            } else if (phase == 'BREAK') {
                if (cycleCounter == 3) {
                    clock.start(this.longBreakTime, phase)
                    cycleCounter = 0;
                } else {
                    clock.start(this.shortBreakTime, phase)
                    cycleCounter += 1;
                }
                nextPhase = 'WORK'
            }
            running = true

            clockTimer = setInterval(function(sx) {
                drawClock();
                if (clock.remainingSeconds() <= 0) {
                    timerExpired()
                }
            }, 1000);
        }
    }

    function timerExpired() {
        clock.stop()
        window.clearInterval(clockTimer)
        clockTimer = 0
        running = false
        phase = nextPhase
        blinking = true
        
        if (blinkDisabled) {
            drawBlink()
        } else {
            clockTimer = setInterval(function(sx) {
                drawBlink()
            }, 1000);
        }

        if (alarmFileName) {
            audioElement = new Audio(alarmFileName)
            audioElement.play()
        }
    }

    function reset() {
        clock.stop()
        window.clearInterval(clockTimer)
        clockTimer = 0
        running = false
        blinking = false
        phase = 'WORK'
        cycleCounter = 0
        skipNextKeyUp = true
        drawNextPhasePreview()
    }

    function drawBlink(jsn) {
        clock.drawBlink()
        clockface.text === true && $SD.api.setTitle(context, "0:00", null);
        $SD.api.setImage(
            context,
            clock.getImageData()
        );
    }

    function drawNextPhasePreview(jsn) {
        clock.drawNextPhasePreview(phase)
        clockface.text === true && $SD.api.setTitle(context, `0:00`, null);
        $SD.api.setImage(
            context,
            clock.getImageData()
        );
    }

    function drawClock(jsn) {
        var remainingSeconds = Math.round(clock.drawClock());
        var seconds = ("" + remainingSeconds % 60).padStart(2, 0)
        var minutes = Math.floor(remainingSeconds / 60)
        clockface.text === true && $SD.api.setTitle(context, `${minutes}:${seconds}`, null);
        $SD.api.setImage(
            context,
            clock.getImageData()
        );
    }

    function destroyClock() {
        if(clockTimer !== 0) {
            window.clearInterval(clockTimer);
            clockTimer = 0;
        }
    }

    function setClockFace(newClockFace) {
        clockface = newClockFace;
        clock.setColors(clockface.colors);
        clockface.text !== true && $SD.api.setTitle(context, '', null);

        if (running) {
            drawClock();
        } else if (!blinking) {
            drawNextPhasePreview()
        }
        
    }

    function setAlarmNum(idx) {
        if (idx >= 0) {
            alarmFileName = `action/${sounds[idx].filename}`
        } else {
            alarmFileName = null
        }
    }

    function setWorkTime(time) {
        this.workTime = time
    }

    function setShortBreakTime(time) {
        this.shortBreakTime = time
    }

    function setLongBreakTime(time) {
        this.longBreakTime = time
    }

    function setBlinkDisabled(disabled) {
        blinkDisabled = disabled
    }

    function setClockFaceNum(idx) {
        currentClockFaceIdx = idx < clockfaces.length ? idx : 0;
        this.currentClockFaceIdx = currentClockFaceIdx;
        setClockFace(clockfaces[currentClockFaceIdx]);
    }

    createClock();

    return {
        clock: clock,
        clockTimer: clockTimer,
        clockface: clockface,
        currentClockFaceIdx: currentClockFaceIdx,
        name: name,
        drawClock: drawClock,
        origContext: origContext,
        destroyClock: destroyClock,
        buttonPressed: buttonPressed,
        longBreakTime: longBreakTime,
        shortBreakTime: shortBreakTime,
        workTime: workTime,
        setAlarmNum: setAlarmNum,
        checkButtonHeld: checkButtonHeld,
        setClockFaceNum: setClockFaceNum,
        setWorkTime: setWorkTime,
        setShortBreakTime: setShortBreakTime,
        setLongBreakTime: setLongBreakTime,
        setBlinkDisabled: setBlinkDisabled
    };
}
