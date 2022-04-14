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
        const instance = this.cache[jsn.context]['tomato'];

        if (!settings || !instance) return;

        instance.setCachedSettings(settings);

        if (settings.hasOwnProperty('clock_index')) { 
            instance.setClockFaceNum(Number(settings.clock_index));
        }
        if (settings.hasOwnProperty('alarm_filename')) {
            instance.setAlarmFileName(settings.alarm_filename);
        }
        if (settings.hasOwnProperty('alarm_volume')) { 
            instance.setAlarmVolume(settings.alarm_volume)
        }
        if (settings.hasOwnProperty('clock_type')) {
            instance.setClockType(settings.clock_type);
        }
        if (settings.hasOwnProperty('work_time')) {
            instance.setWorkTime(parseInt(settings.work_time) * 60)
        }
        if (settings.hasOwnProperty('short_break_time')) { 
            instance.setShortBreakTime(parseInt(settings.short_break_time) * 60)
        }
        if (settings.hasOwnProperty('long_break_time')) { 
            instance.setLongBreakTime(parseInt(settings.long_break_time) * 60)
        }
        if (settings.hasOwnProperty('disable_blink')) { 
            instance.setBlinkDisabled(settings.disable_blink)
        }
        if (settings.hasOwnProperty('expire_action')) { 
            instance.setExpireAction(settings.expire_action)
        }
        if (settings.hasOwnProperty('state')) { 
            instance.setState(settings.state)
        }
    },

    onWillAppear: function(jsn) {
        if (!jsn.payload || !jsn.payload.hasOwnProperty('settings')) return;

        console.log('onWillAppear', jsn);

        let instance = this.cache[jsn.context]?.['tomato'];
        if (!instance) {
            this.cache[jsn.context] = {
                tomato: new Tomato(jsn.context)
            }
            this.onDidReceiveSettings(jsn);
        } else {
            // Force a redraw. This event is fired both on brand new instances, a prexisting 
            // instance becoming visible again, and the instance being deleted 
            // an re-added to the same position on the SD
            instance.drawClock()
        }
    },

    onWillDisappear: function(jsn) {
        // Likely a no-op, we want to keep the Tomato instance to keep the timers running
        console.log('onWillDisappear', jsn)
    },

    onKeyDown: function(jsn) {
        const instance = this.cache[jsn.context]['tomato'];
        /** Edge case +++ */
        if (!instance) this.onWillAppear(jsn);

        this.cache[jsn.context]['buttonCheck'] = true
        
        setTimeout(function() {
            if (this.cache[jsn.context]['buttonCheck']) {
                this.cache[jsn.context]['skipNext'] = true
                instance.reset()
            }
        }.bind(this), 1750)

    },

    onKeyUp: function(jsn) {
        const instance = this.cache[jsn.context]['tomato'];
        this.cache[jsn.context]['buttonCheck'] = false
        
        if (this.cache[jsn.context]['skipNext']) {
            this.cache[jsn.context]['skipNext'] = false
        } else {
            /** Edge case +++ */
            if (!instance) this.onWillAppear(jsn);
            else instance.buttonPressed();
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
        this.volume = 1
        this.cachedSettings = {}
        this.expireAction = "2_press"  // 2_press, 1_press, auto
        this.autostartTimeout = null

        this.config = {
            workTime: 25 * 60,
            shortBreakTime: 5 * 60,
            longBreakTime: 25 * 60,
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
        }
    }

    shortBreakPhase() {
        return {
            name: "BREAK",
            duration: this.config.shortBreakTime,
        }
    }

    longBreakPhase() {
        return {
            name: "LONG_BREAK",
            duration: this.config.longBreakTime,
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
            this.start()
        }
    }

    start() {
        if (this.state == "RUNNING") {
            // Avoid double start with auto mode
            return
        }

        this.state = "RUNNING"
        this.phase = this.nextPhase
        this.clock.start(this.phase.duration, this.phase.name)

        if (this.phase.name == 'WORK') {
            if (this.cycleCounter == 4) {
                this.nextPhase = this.longBreakPhase()
                this.cycleCounter = 0;
            } else {
                this.nextPhase = this.shortBreakPhase()
                this.cycleCounter += 1;
            }
        } else {
            this.nextPhase = this.workPhase()
        }

        if (this.interval) {
            // Auto mode rollover will still have the interval set
            window.clearInterval(this.interval)
        }

        this.interval = window.setInterval(function(sx) {
            var remainingSeconds = this.drawClock();
            if (remainingSeconds <= 0) {
                this.timerExpired()
            }
        }.bind(this), 1000);
    }

    pause() {
        this.state = "MIDPHASE_PAUSE"
        this.clock.pause()
    }

    unpause() {
        this.state = "RUNNING"
        this.clock.unpause()
    }

    alarmAcknowledged() {
        this.state = "PAUSED"

        window.clearInterval(this.interval);
        this.interval = 0;
        this.drawClock()

        if (this.audioElement) {
            this.audioElement.pause()
        }

        this.saveState()

        if (this.expireAction == '1_press' || this.expireAction == 'auto') {
            if (this.autostartTimeout) {
                window.clearTimeout(this.autostartTimeout)
                this.autostartTimeout = 0
            }
            this.start()
        }

        return;
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
            this.audioElement.volume = this.volume
            this.audioElement.play()

            if (this.expireAction == 'auto') {
                const self = this
                this.audioElement.onloadedmetadata = function() {
                    // Start the next phase when the alarm finishes ringing
                    self.autostartTimeout = window.setTimeout(function() {
                        self.start()
                    }, this.duration * 1000)
                };
            }
        } else if (this.expireAction == 'auto') {
            // No sound effect, so arbitrarily pick 5 seconds before the next phase auto starts
            this.autostartTimeout = window.setTimeout(function() {
                this.start()
            }, 5000)
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

        this.saveState()
        this.drawClock()
    }


    saveState() {
        const state = {
            phase: (this.state == 'PAUSED' || this.state == 'ALARMING') ? this.nextPhase.name : this.phase.name,
            cycle: this.cycleCounter
        }
        this.cachedSettings['state'] = state

        $SD.api.setSettings(this.context, this.cachedSettings)
    }

    setState(state)  {
        if (this.state == 'PAUSED') {
            this.cycleCounter = state.cycle

            if (state.phase == "WORK") {
                this.nextPhase = this.workPhase()
            } else if (state.phase == "BREAK") {
                this.nextPhase = this.shortBreakPhase()
            } else if (state.phase == "LONG_BREAK") {
                this.nextPhase = this.longBreakPhase()
            }

            this.drawClock()
        }
    }
    
    setWorkTime(time) {
        this.config.workTime = time || 25 * 60

        if (this.nextPhase.name == "WORK") {
            this.nextPhase.duration = this.config.workTime
            this.drawClock()
        }
    }

    setShortBreakTime(time) {
        this.config.shortBreakTime = time || 5 * 60

        if (this.nextPhase.name == "BREAK") {
            this.nextPhase.duration = this.config.shortBreakTime
            this.drawClock()
        }
    }

    setLongBreakTime(time) {
        this.config.longBreakTime = time || 25 * 60

        if (this.nextPhase.name == "LONG_BREAK") {
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
    
    setAlarmVolume(volume) {
        this.volume = volume
    }

    setClockFaceNum(idx) {
        var newClockFaceIdx = Math.min(Math.max(0, idx), clockfaces.length - 1)
        this.clockface = clockfaces[newClockFaceIdx];
        this.clock.setColors(this.clockface.colors);

        this.drawClock();
    }

    // This is a workaround for $SD.api.setSettings() not working in onWillDisappear.
    // Instead, write new settings each time that work/break phase ends
    setCachedSettings(settings) {
        this.cachedSettings = settings
    }

    setExpireAction(action) {
        this.expireAction = action
    }
}
