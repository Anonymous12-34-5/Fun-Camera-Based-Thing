const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingOverlay = document.getElementById('loading-overlay');

let particles = [];
let handsDetected = { left: false, right: false };
let interactionState = 'NEUTRAL'; // NEUTRAL, MERGING, PURPLE
let purpleOrbSize = 0;

class Particle {
    constructor(x, y, color, speedScale = 1) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.vx = (Math.random() - 0.5) * 5 * speedScale;
        this.vy = (Math.random() - 0.5) * 5 * speedScale;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;

        // Attraction to center if in MERGING state
        if (interactionState === 'MERGING' || interactionState === 'PURPLE') {
            // This will be handled in the main loop to point towards the midpoint
        }
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function onResults(results) {
    // Hide loading once we get results
    if (loadingOverlay.style.opacity !== '0') {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => loadingOverlay.style.display = 'none', 500);
    }

    // Resize canvas
    if (canvasElement.width !== window.innerWidth || canvasElement.height !== window.innerHeight) {
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;
    }

    // Draw video frame mirrored
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);

    // Enhance visibility
    canvasCtx.filter = 'brightness(1.5) contrast(1.2) saturate(1.2)';
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.filter = 'none'; // Reset filter for particles

    canvasCtx.restore();

    // Darken background for better effect
    canvasCtx.fillStyle = 'rgba(0,0,0,0.3)';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    let leftTip = null;
    let rightTip = null;

    if (results.multiHandLandmarks && results.multiHandedness) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
            const label = results.multiHandedness[index].label;
            // Note: MediaPipe labels are mirrored relative to the real world if video is mirrored
            // But we already mirrored the draw above, so 'Left' usually means actual left if not careful.
            // MP 'Left' is user's right hand in a webcam mirror.

            const indexTip = landmarks[8];
            const x = (1 - indexTip.x) * canvasElement.width; // Mirroring X back to match mirrored video
            const y = indexTip.y * canvasElement.height;

            if (label === 'Right') { // Actually User's Left Hand
                leftTip = { x, y };
                emitParticles(x, y, '#ff4b2b'); // Red
            } else { // Actually User's Right Hand
                rightTip = { x, y };
                emitParticles(x, y, '#0082ff'); // Blue
            }
        });
    }

    handleInteraction(leftTip, rightTip);
    updateAndDrawParticles();
}

function emitParticles(x, y, color) {
    for (let i = 0; i < 3; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function handleInteraction(left, right) {
    if (left && right) {
        const dist = Math.sqrt(Math.pow(left.x - right.x, 2) + Math.pow(left.y - right.y, 2));
        const midX = (left.x + right.x) / 2;
        const midY = (left.y + right.y) / 2;

        if (dist < 150) {
            interactionState = dist < 50 ? 'PURPLE' : 'MERGING';

            // Interaction visual
            if (interactionState === 'MERGING') {
                const intensity = 1 - (dist / 150);
                drawGlow(midX, midY, 50 * intensity, 'rgba(164, 66, 245, 0.5)');
                // Pull particles to center
                particles.forEach(p => {
                    p.vx += (midX - p.x) * 0.05;
                    p.vy += (midY - p.y) * 0.05;
                });
            } else {
                purpleOrbSize = Math.min(purpleOrbSize + 2, 80);
                drawPurpleOrb(midX, midY, purpleOrbSize);
                // Explosive particles
                for (let i = 0; i < 5; i++) {
                    const p = new Particle(midX, midY, '#a442f5', 2);
                    particles.push(p);
                }
            }
        } else {
            interactionState = 'NEUTRAL';
            purpleOrbSize = Math.max(0, purpleOrbSize - 5);
        }
    } else {
        interactionState = 'NEUTRAL';
        purpleOrbSize = Math.max(0, purpleOrbSize - 5);
    }
}

function drawGlow(x, y, radius, color) {
    const gradient = canvasCtx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    canvasCtx.fillStyle = gradient;
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, radius, 0, Math.PI * 2);
    canvasCtx.fill();
}

function drawPurpleOrb(x, y, size) {
    canvasCtx.save();
    canvasCtx.shadowBlur = 30;
    canvasCtx.shadowColor = '#a442f5';

    // Core
    const grad = canvasCtx.createRadialGradient(x, y, 0, x, y, size);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, '#e0b0ff');
    grad.addColorStop(0.5, '#a442f5');
    grad.addColorStop(1, 'transparent');

    canvasCtx.fillStyle = grad;
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size, 0, Math.PI * 2);
    canvasCtx.fill();

    // Electric arcs (simulated)
    canvasCtx.strokeStyle = 'rgba(255,255,255,0.8)';
    canvasCtx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        canvasCtx.beginPath();
        let angle = Math.random() * Math.PI * 2;
        canvasCtx.moveTo(x + Math.cos(angle) * size * 0.5, y + Math.sin(angle) * size * 0.5);
        canvasCtx.lineTo(x + Math.cos(angle) * size * 1.2, y + Math.sin(angle) * size * 1.2);
        canvasCtx.stroke();
    }

    canvasCtx.restore();
}

function updateAndDrawParticles() {
    canvasCtx.globalCompositeOperation = 'lighter';
    particles = particles.filter(p => {
        p.update();
        if (p.life > 0) {
            p.draw(canvasCtx);
            return true;
        }
        return false;
    });
    canvasCtx.globalCompositeOperation = 'source-over';
}

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 1280,
    height: 720
});

camera.start();
