class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    init() {
        this.ACCELERATION = 2000;
        this.DRAG = 1400;
        this.JUMP_VELOCITY = -450;
        this.SUPER_JUMP_VELOCITY = -820;
        this.MAX_SPEED = 500;
        this.SPEED_CAP = 10;
        this.SPEED_RATE = 0.00010;

        this.speedMult = 1.0;
        this.elapsed = 0;
        this.hasKey = false;
        this.isDead = false;
        this.hasWon = false;
        this.wasOnGround = false;
        this.jumpCount = 0;
        this.score = 0;
    }

    create() {
        this.mapW = 120 * 18;
        this.mapH = 20  * 18;

        this.physics.world.setBounds(0, 0, this.mapW * 3, this.mapH);
        this.physics.world.gravity.y = 1500;
        this.cameras.main.setBackgroundColor('#0a0a1a');

        this.groundLayers   = [];
        this.platformLayers = [];

        for (let copy = 0; copy < 3; copy++) {
            const ox = this.mapW * copy;
            const map = this.make.tilemap({ key: 'platformer-level-1' });
            const tileset = map.addTilesetImage("tilemap_packed", "tilemap_tiles");

            if (map.getLayer('Decor')) {
                map.createLayer("Decor", tileset, ox, 0);
            }

            const g = map.createLayer("Ground",    tileset, ox, 0);
            const p = map.createLayer("Platforms", tileset, ox, 0);

            g.setCollisionByProperty({ collides: true });
            p.setCollisionByProperty({ collides: true });
            g.setTint(0xff7733);
            p.setTint(0x44aaff);

            this.groundLayers.push(g);
            this.platformLayers.push(p);

            if (copy === 0) this.map = map;
        }

        this.drawBackground();

        this.keyGroup   = this.physics.add.staticGroup();
        this.spikeGroup = this.physics.add.staticGroup();
        this.treeGroup  = this.physics.add.staticGroup();
        this.spawnObjects();

        this.player = this.physics.add.sprite(60, 50, "platformer_characters", "tile_0000.png")
            .setDepth(5)
            .setCollideWorldBounds(false);
        this.player.body.setMaxVelocityX(this.MAX_SPEED * this.SPEED_CAP);

        this.groundLayers.forEach(l   => this.physics.add.collider(this.player, l, this.onLand, null, this));
        this.platformLayers.forEach(l => this.physics.add.collider(this.player, l, this.onLand, null, this));

        this.physics.add.overlap(this.player, this.spikeGroup, () => this.triggerDeath(), null, this);
        this.physics.add.overlap(this.player, this.treeGroup,  () => this.triggerDeath(), null, this);
        this.physics.add.overlap(this.player, this.keyGroup,   (p, zone) => this.collectKey(zone), null, this);

        this.buildParticles();
        this.buildUI();
        this.buildAudio();

        this.cameras.main.setBounds(0, 0, this.mapW * 3, this.mapH);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setFollowOffset(0, 0);
        this.cameras.main.setDeadzone(50, 40);
        this.cameras.main.setZoom(1.5);
        this.cameras.main.fadeIn(400, 0, 0, 0);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up:    Phaser.Input.Keyboard.KeyCodes.W,
            left:  Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.input.keyboard.on('keydown-SPACE', () => this.tryJump());
        this.input.keyboard.on('keydown-UP',    () => this.tryJump());
        this.input.keyboard.on('keydown-W',     () => this.tryJump());
    }

    drawBackground() {
        const W = this.mapW * 3, H = this.mapH;
        const g = this.add.graphics().setDepth(-10);
        g.lineStyle(1, 0x001133, 0.4);
        for (let x = 0; x < W; x += 80) g.lineBetween(x, 0, x, H);
        for (let y = 0; y < H; y += 80) g.lineBetween(0, y, W, y);

        const p1 = this.add.graphics().setDepth(-9).setScrollFactor(0.15);
        const p2 = this.add.graphics().setDepth(-8).setScrollFactor(0.4);
        this.drawMountains(p1, 0x220044, 0.5, W, H, 12);
        this.drawMountains(p2, 0x002244, 0.6, W, H, 7);
    }

    drawMountains(g, color, alpha, W, H, peaks) {
        g.fillStyle(color, alpha);
        const step = W / peaks;
        for (let i = 0; i < peaks; i++) {
            const x = i * step;
            const h = H * 0.15 + Math.sin(i * 2.3) * H * 0.12;
            g.fillTriangle(x, H, x + step / 2, H - h, x + step, H);
        }
    }

    spawnObjects() {
        const objLayer = this.map.getObjectLayer('Objects');
        if (!objLayer) return;

        objLayer.objects.forEach(obj => {
            const type = this.getObjType(obj);
            const x = obj.x + (obj.width  || 18) / 2;
            const y = obj.y - (obj.height || 18) / 2;

            for (let copy = 0; copy < 3; copy++) {
                const cx = x + this.mapW * copy;
                if (type === 'key')   this.spawnKey(cx, y);
                if (type === 'spike') this.spawnHazard(cx, y, obj.width||18, obj.height||18, 'spike');
                if (type === 'tree')  this.spawnHazard(cx, y, obj.width||18, obj.height||36, 'tree');
            }
        });
    }

    getObjType(obj) {
        if (obj.properties) {
            const t = obj.properties.find(p => p.name === 'type');
            if (t && t.value !== 'string') return t.value.toLowerCase();
        }
        if (obj.type  && obj.type  !== '') return obj.type.toLowerCase();
        if (obj.class && obj.class !== '') return obj.class.toLowerCase();
        if (obj.name  && obj.name  !== '') return obj.name.toLowerCase();
        return '';
    }

    spawnKey(x, y) {
        const g = this.add.graphics().setDepth(4);
        g.fillStyle(0xffdd00, 1);
        g.fillCircle(0, 0, 9);
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(-3, -3, 3);
        g.lineStyle(2, 0xffffff, 0.8);
        g.strokeCircle(0, 0, 9);
        g.x = x; g.y = y;
        this.tweens.add({ targets: g, y: y - 7, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        const zone = this.add.zone(x, y, 18, 18);
        this.physics.add.existing(zone, true);
        this.keyGroup.add(zone);
        zone._gfx = g;
        zone._active = true;
    }

    spawnHazard(x, y, w, h, kind) {
        const zone = this.add.zone(x, y, w - 2, h - 2);
        this.physics.add.existing(zone, true);
        if (kind === 'spike') this.spikeGroup.add(zone);
        else                  this.treeGroup.add(zone);
    }

    buildParticles() {
        this.moveEmitter = this.add.particles(0, 0, "kenny-particles", {
            frame: ['circle_01.png', 'circle_02.png'],
            frequency: 55,
            quantity: 1,
            speedX: { min: 10, max: 60 },
            speedY: { min: -10, max: 10 },
            scale: { start: 0.15, end: 0 },
            alpha: { start: 0.7, end: 0 },
            lifespan: 220,
            tint: [0x00ffff, 0x0055ff],
            depth: 3
        });
        this.moveEmitter.stop();

        this.jumpEmitter = this.add.particles(0, 0, "kenny-particles", {
            frame: ['star_01.png', 'star_02.png'],
            frequency: -1,
            speed: { min: 80, max: 200 },
            scale: { start: 0.2, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 250, max: 500 },
            angle: { min: 210, max: 330 },
            tint: [0xffff00, 0xffaa00, 0xffffff],
            depth: 3
        });

        this.landEmitter = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_01.png', 'smoke_02.png'],
            frequency: -1,
            speed: { min: 20, max: 80 },
            scale: { start: 0.15, end: 0 },
            alpha: { start: 0.5, end: 0 },
            lifespan: 280,
            angle: { min: 170, max: 370 },
            depth: 3
        });

        this.collectEmitter = this.add.particles(0, 0, "kenny-particles", {
            frame: ['star_01.png', 'star_02.png'],
            frequency: -1,
            speed: { min: 80, max: 220 },
            scale: { start: 0.2, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 300, max: 600 },
            tint: [0xffff00, 0xffffff, 0xff8800],
            depth: 6
        });

        this.deathEmitter = this.add.particles(0, 0, "kenny-particles", {
            frame: ['circle_01.png', 'circle_02.png'],
            frequency: -1,
            speed: { min: 120, max: 380 },
            scale: { start: 0.3, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 400, max: 900 },
            tint: [0xff0000, 0xff4400, 0xffcc00],
            depth: 8
        });
    }

    buildAudio() {
        this._sfx = {};
        ['sfx_jump', 'sfx_superjump', 'sfx_land', 'sfx_collect', 'sfx_die'].forEach(k => {
            if (this.cache.audio.has(k)) {
                this._sfx[k] = this.sound.add(k, { volume: 0.5 });
            }
        });
    }

    playSfx(key, vol = 0.5) {
        if (this._sfx && this._sfx[key]) this._sfx[key].play({ volume: vol });
    }

    buildUI() {
        const base = { fontFamily: 'monospace', stroke: '#000000', strokeThickness: 3 };

        this.scoreText = this.add.text(16, 16, 'SCORE: 0', {
            ...base, fontSize: '20px', color: '#00ffff'
        }).setScrollFactor(0).setDepth(10);

        this.add.text(16, 40, `BEST: ${this.registry.get('highScore') || 0}`, {
            ...base, fontSize: '13px', color: '#888888'
        }).setScrollFactor(0).setDepth(10);

        this.speedText = this.add.text(16, 58, 'SPEED: x1.0', {
            ...base, fontSize: '13px', color: '#ff8800'
        }).setScrollFactor(0).setDepth(10);

        this.speedBar = this.add.graphics().setScrollFactor(0).setDepth(10);

        this.keyIndicator = this.add.text(1424, 16, '★ SUPER JUMP READY', {
            ...base, fontSize: '15px', color: '#ffff00'
        }).setScrollFactor(0).setDepth(10).setOrigin(1, 0).setVisible(false);

        this.tweens.add({ targets: this.keyIndicator, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
    }

    onLand() {
        if (!this.wasOnGround && this.player.body.blocked.down) {
            this.landEmitter.explode(6, this.player.x, this.player.y + 14);
            this.cameras.main.shake(60, 0.003);
            this.playSfx('sfx_land', 0.4);
        }
    }

    tryJump() {
        if (this.isDead || this.hasWon) return;
        const onGround = this.player.body.blocked.down;

        if (onGround) {
            if (this.hasKey) {
                this.player.body.setVelocityY(this.SUPER_JUMP_VELOCITY);
                this.hasKey = false;
                this.keyIndicator.setVisible(false);
                this.jumpEmitter.explode(22, this.player.x, this.player.y + 14);
                this.cameras.main.shake(140, 0.007);
                this.playSfx('sfx_superjump', 0.8);
            } else {
                this.player.body.setVelocityY(this.JUMP_VELOCITY);
                this.jumpEmitter.explode(8, this.player.x, this.player.y + 14);
                this.playSfx('sfx_jump', 0.6);
            }
            this.player.anims.play('jump', true);
            this.jumpCount = 1;
        } else if (this.jumpCount < 2) {
            this.player.body.setVelocityY(this.JUMP_VELOCITY * 0.8);
            this.jumpCount = 2;
            this.jumpEmitter.explode(5, this.player.x, this.player.y);
            this.playSfx('sfx_jump', 0.35);
        }
    }

    collectKey(zone) {
        if (!zone._active || this.hasKey) return;
        zone._active = false;
        zone._gfx && zone._gfx.setVisible(false);
        zone.body.enable = false;
        this.hasKey = true;
        this.score += 100;
        this.keyIndicator.setVisible(true);
        this.collectEmitter.explode(14, this.player.x, this.player.y);
        this.playSfx('sfx_collect', 0.7);
        this.tweens.add({
            targets: this.player, alpha: 0.3,
            duration: 80, yoyo: true, repeat: 4,
            onComplete: () => this.player.setAlpha(1)
        });
    }

    triggerDeath() {
        if (this.isDead || this.hasWon) return;
        this.isDead = true;

        this.deathEmitter.explode(28, this.player.x, this.player.y);
        this.player.setVisible(false);
        this.player.body.setVelocity(0, 0);
        this.player.body.setAllowGravity(false);
        this.moveEmitter.stop();
        this.playSfx('sfx_die', 0.8);

        const flash = this.add.rectangle(720, 225, 1440, 450, 0xff0000, 0.45)
            .setScrollFactor(0).setDepth(15);
        this.tweens.add({ targets: flash, alpha: 0, duration: 500 });
        this.cameras.main.shake(300, 0.015);

        const hs = this.registry.get('highScore') || 0;
        if (this.score > hs) this.registry.set('highScore', this.score);

        this.time.delayedCall(1400, () => {
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('gameOverScene', {
                    score: this.score,
                    highScore: Math.max(this.score, hs),
                    won: false
                });
            });
        });
    }

    triggerWin() {
        if (this.isDead || this.hasWon) return;
        this.hasWon = true;

        this.player.body.setVelocity(0, 0);
        this.player.body.setAllowGravity(false);
        this.moveEmitter.stop();

        // Win flash — green
        const flash = this.add.rectangle(720, 225, 1440, 450, 0x00ff88, 0.4)
            .setScrollFactor(0).setDepth(15);
        this.tweens.add({ targets: flash, alpha: 0, duration: 600 });

        // Burst of collect particles
        this.collectEmitter.explode(40, this.player.x, this.player.y);
        this.cameras.main.shake(200, 0.008);

        // Win text
        this.add.text(720, 200, 'YOU WIN!', {
            fontSize: '64px', fontFamily: 'monospace',
            color: '#00ff88', stroke: '#003322', strokeThickness: 6
        }).setScrollFactor(0).setDepth(20).setOrigin(0.5);

        this.add.text(720, 270, `SCORE: ${this.score}`, {
            fontSize: '28px', fontFamily: 'monospace',
            color: '#ffffff', stroke: '#000000', strokeThickness: 3
        }).setScrollFactor(0).setDepth(20).setOrigin(0.5);

        const hs = this.registry.get('highScore') || 0;
        if (this.score > hs) this.registry.set('highScore', this.score);

        this.time.delayedCall(3000, () => {
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('gameOverScene', {
                    score: this.score,
                    highScore: Math.max(this.score, hs),
                    won: true
                });
            });
        });
    }

    checkLoop() {
        if (this.player.x > this.mapW * 2) {
            this.player.x -= this.mapW;
            this.cameras.main.scrollX -= this.mapW;
        }
    }

    update(time, delta) {
        if (this.isDead || this.hasWon) return;

        this.elapsed += delta;
        this.speedMult = Math.min(this.SPEED_CAP, 1.0 + this.elapsed * this.SPEED_RATE);
        const maxSpd   = this.MAX_SPEED * this.speedMult;
        const MIN_SPEED = 300 * this.speedMult;

        const body    = this.player.body;
        const goRight = this.cursors.right.isDown || this.wasd.right.isDown;
        const goLeft  = this.cursors.left.isDown  || this.wasd.left.isDown;

        if (goRight) {
            body.setAccelerationX(this.ACCELERATION * this.speedMult);
            body.setMaxVelocityX(maxSpd);
        } else if (goLeft) {
            body.setAccelerationX(-this.ACCELERATION * this.speedMult);
            body.setMaxVelocityX(maxSpd);
        } else {
            body.setAccelerationX(0);
        }

        // Always move forward
        if (body.velocity.x < MIN_SPEED) {
            body.setVelocityX(MIN_SPEED);
        }

        const onGround = body.blocked.down;
        if (onGround) {
            this.jumpCount = 0;
            if (Math.abs(body.velocity.x) > 10) {
                this.player.anims.play('walk', true);
            } else {
                this.player.anims.play('idle', true);
            }
        }

        if (onGround && !this.wasOnGround) {
            this.landEmitter.explode(6, this.player.x, this.player.y + 14);
            this.cameras.main.shake(60, 0.003);
            this.playSfx('sfx_land', 0.4);
        }
        this.wasOnGround = onGround;

        const spd = Math.abs(body.velocity.x);
        if (spd > 50 && onGround) {
            this.moveEmitter.setPosition(this.player.x, this.player.y + 10);
            this.moveEmitter.start();
        } else {
            this.moveEmitter.stop();
        }

        this.cameras.main.setFollowOffset(0, 0);

        if (this.player.body.blocked.right) {
            this.triggerDeath();
        }

        this.checkLoop();

        if (this.player.y > this.mapH + 60) this.triggerDeath();
        if (this.player.x < -100)            this.triggerDeath();

        // Win condition — survive to score 500
        if (this.score >= 500) {
            this.triggerWin();
        }

        this.score = Math.floor(this.elapsed / 100 * this.speedMult);
        this.scoreText.setText(`SCORE: ${this.score}`);
        this.speedText.setText(`SPEED: x${this.speedMult.toFixed(1)}`);

        this.speedBar.clear();
        const pct = (this.speedMult - 1) / (this.SPEED_CAP - 1);
        const hue = 0.33 - pct * 0.33;
        this.speedBar.fillStyle(0x222222, 0.5);
        this.speedBar.fillRect(16, 74, 120, 7);
        this.speedBar.fillStyle(Phaser.Display.Color.HSLToColor(hue, 1, 0.5).color, 1);
        this.speedBar.fillRect(16, 74, 120 * pct, 7);
    }
}