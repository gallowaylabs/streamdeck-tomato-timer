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
        if (!settings || !clock) return;

        if (settings.hasOwnProperty('clock_index')) { 
            if (clock) {
                clock.setClockFaceNum(Number(settings.clock_index));
            }
        }
        if (settings.hasOwnProperty('alarm_filename')) {
            if (clock) {
                clock.setAlarmFileName(settings.alarm_filename);
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

        let found = this.cache[jsn.context];
        if (!found) {
            const clock = new Tomato(jsn.context);
            this.cache[jsn.context] = clock;
            this.onDidReceiveSettings(jsn);
        }
    },

    onWillDisappear: function(jsn) {
        // Likely a no-op, we want to keep the Tomato instance to keep the timers running
    },

    onKeyDown: function(jsn) {
        const clock = this.cache[jsn.context];
        /** Edge case +++ */
        if (!clock) this.onWillAppear(jsn);


        this.cache[`${jsn.context}-buttoncheck`] = true
        
        setTimeout(function() {
            if (this.cache[`${jsn.context}-buttoncheck`]) {
                this.cache[`${jsn.context}-skipnext`] = true
                clock.reset()
            }
        }.bind(this), 1750)

    },

    onKeyUp: function(jsn) {
        const clock = this.cache[jsn.context];
        this.cache[`${jsn.context}-buttoncheck`] = false
        
        if (this.cache[`${jsn.context}-skipnext`]) {
            this.cache[`${jsn.context}-skipnext`] = false
        } else {
            /** Edge case +++ */
            if (!clock) this.onWillAppear(jsn);
            else clock.buttonPressed();
        }
    }

};

class Tomato {
    constructor(context) {
        this.context = context
        this.canvas = document.createElement('canvas')
        this.canvas.width = 144;
        this.canvas.height = 144;

        this.clock = new Clock(this.canvas);
        this.clockface = clockfaces[0]
        this.clock.setColors(this.clockface.colors);

        this.interval = 0
        this.cycleCounter = 0
        this.audioElement = null

        this.config = {
            workTime: 25 * 60,
            shortBreakTime: 5 * 60,
            longBreakTime: 10 * 60,
            alarmFileName: null,
            blinkDisabled: false, 
        }

        // PAUSED: between phases. 
        // RUNNING: timer is counting down in a phase
        // ALARMING: timer has run out and is alerting the user about this
        this.state = 'PAUSED' 

        this.phase = null
        this.nextPhase = this.workPhase()

        this.drawClock()
    }

    workPhase() {
        return {
            name: "WORK",
            duration: this.config.workTime,
            type: "WORK"
        }
    }

    shortBreakPhase() {
        return {
            name: "BREAK",
            duration: this.config.shortBreakTime,
            type: "SHORT"
        }
    }

    longBreakPhase() {
        return {
            name: "BREAK",
            duration: this.config.longBreakTime,
            type: "LONG"
        }
    }

    buttonPressed() {
        if (this.state == 'ALARMING') {
            this.alarmAcknowledged()
        } else if (this.state == 'RUNNING') {
            this.pause()
        } else if (this.state == 'MIDPHASE_PAUSE') {
            this.unpause()
        } else if (this.state == 'PAUSED') {
            this.startPhase()
        }
    }

    startPhase() {
        this.state = "RUNNING"
        this.phase = this.nextPhase
        this.clock.start(this.phase.duration, this.phase.name)

        if (this.phase.name == 'WORK') {
            if (this.cycleCounter == 3) {
                this.nextPhase = this.longBreakPhase()
                this.cycleCounter = 0;
            } else {
                this.nextPhase = this.shortBreakPhase()
                this.cycleCounter += 1;
            }
        } else {
            this.nextPhase = this.workPhase()
        }

        this.interval = setInterval(function(sx) {
            var remainingSeconds = this.drawClock();
            if (remainingSeconds <= 0) {
                this.timerExpired()
            }
        }.bind(this), 1000);
    }

    alarmAcknowledged() {
        this.state = "PAUSED"

        window.clearInterval(this.interval);
        this.interval = 0;
        this.drawClock()

        if (this.audioElement) {
            this.audioElement.pause()
        }
        return;
    }

    pause() {
        this.state = "MIDPHASE_PAUSE"
        this.clock.pause()
    }

    unpause() {
        this.state = "RUNNING"
        this.clock.unpause()
    }

    timerExpired() {
        this.clock.stop()
        window.clearInterval(this.interval)
        this.interval = 0
        this.state = "ALARMING"
        
        if (this.config.blinkDisabled) {
            // Draw it once to show the "expired" image
            this.drawClock()
        } else {
            this.interval = setInterval(function(sx) {
                // Redraw it every second, as the background/text color alternates every time
                this.drawClock()
            }.bind(this), 1000);
        }

        if (this.config.alarmFileName) {
            this.audioElement = new Audio(this.config.alarmFileName)
            this.audioElement.play()
        }
    }

    drawClock() {
        if (this.state == 'RUNNING' || this.state == "MIDPHASE_PAUSE") {
            var remainingSeconds = Math.round(this.clock.drawClock());
            var seconds = ("" + remainingSeconds % 60).padStart(2, 0)
            var minutes = Math.floor(remainingSeconds / 60)
            
            this.clockface.text === true && $SD.api.setTitle(this.context, `${minutes}:${seconds}`, null);
            $SD.api.setImage(
                this.context,
                this.clock.getImageData()
            );

            return remainingSeconds
        } else if (this.state == 'ALARMING') {
            this.clock.drawBlink()
            this.clockface.text === true && $SD.api.setTitle(this.context, "0:00", null);
            $SD.api.setImage(
                this.context,
                this.clock.getImageData()
            );
        } else {
            this.clock.drawNextPhasePreview(this.nextPhase.name)
            var minutes = Math.floor(this.nextPhase.duration / 60)
            this.clockface.text === true && $SD.api.setTitle(this.context, `${minutes}:00`, null);
            $SD.api.setImage(
                this.context,
                this.clock.getImageData()
            );
        }
        
        return 0
    }

    reset() {
        this.clock.stop()
        window.clearInterval(this.interval)
        this.interval = 0
        this.state = 'PAUSED'
        this.phase = null
        this.nextPhase = this.workPhase()
        this.cycleCounter = 0
        this.drawClock()
    }

    
    setWorkTime(time) {
        this.config.workTime = time || 25 * 60

        if (this.nextPhase.type == "WORK") {
            this.nextPhase.duration = this.config.workTime
            this.drawClock()
        }
    }

    setShortBreakTime(time) {
        this.config.shortBreakTime = time || 5 * 60

        if (this.nextPhase.type == "SHORT") {
            this.nextPhase.duration = this.config.shortBreakTime
            this.drawClock()
        }
    }

    setLongBreakTime(time) {
        this.config.longBreakTime = time || 10 * 60

        if (this.nextPhase.type == "LONG") {
            this.nextPhase.duration = this.config.longBreakTime
            this.drawClock()
        }
    }

    setBlinkDisabled(disabled) {
        this.config.blinkDisabled = disabled
    }

    setAlarmFileName(name) {
        this.config.alarmFileName = name
    }

    setClockFaceNum(idx) {
        var newClockFaceIdx = Math.min(Math.max(0, idx), clockfaces.length - 1)
        this.clockface = clockfaces[newClockFaceIdx];
        this.clock.setColors(this.clockface.colors);

        this.drawClock();
    }
}
