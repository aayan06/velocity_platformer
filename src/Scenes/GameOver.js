class GameOver extends Phaser.Scene {
    constructor() {
        super("gameOverScene");
    }

    init(data) {
        this.finalScore = data.score || 0;
        this.highScore  = data.highScore || 0;
    }

    create() {
        const { width, height } = this.scale;

        this.add.rectangle(width/2, height/2, width, height, 0x110000);

        this.add.text(width/2, height/2 - 80, 'GAME OVER', {
            fontSize: '64px', fontFamily: 'monospace',
            color: '#ff0044', stroke: '#440011', strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(width/2, height/2, `SCORE: ${this.finalScore}`, {
            fontSize: '28px', fontFamily: 'monospace', color: '#00ffff'
        }).setOrigin(0.5);

        this.add.text(width/2, height/2 + 40, `BEST: ${this.highScore}`, {
            fontSize: '20px', fontFamily: 'monospace', color: '#ffff00'
        }).setOrigin(0.5);

        const prompt = this.add.text(width/2, height/2 + 100, '[ SPACE ] PLAY AGAIN', {
            fontSize: '20px', fontFamily: 'monospace', color: '#ffffff'
        }).setOrigin(0.5);

        this.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

        this.input.keyboard.once('keydown-SPACE', () => {
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('platformerScene');
            });
        });
    }
}