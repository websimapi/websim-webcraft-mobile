import * as THREE from 'three';
import nipplejs from 'nipplejs';

class MinecraftClone {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: document.getElementById('gameCanvas'),
            antialias: false 
        });
        
        this.setupRenderer();
        this.setupWorld();
        this.setupPlayer();
        this.setupControls();
        this.setupUI();
        
        this.animate();
    }

    setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupWorld() {
        // Sky
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Ground
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Generate terrain
        this.blocks = new Map();
        this.generateTerrain();
    }

    generateTerrain() {
        const size = 20;
        const heightMap = this.generateHeightMap(size);
        
        for (let x = -size; x <= size; x++) {
            for (let z = -size; z <= size; z++) {
                const height = heightMap[x + size][z + size];
                for (let y = 0; y <= height; y++) {
                    this.placeBlock(x, y, z, this.getBlockType(y, height));
                }
            }
        }
    }

    generateHeightMap(size) {
        const map = Array(size * 2 + 1).fill(null).map(() => Array(size * 2 + 1));
        
        for (let x = 0; x <= size * 2; x++) {
            for (let z = 0; z <= size * 2; z++) {
                const nx = x / size - 1;
                const nz = z / size - 1;
                const noise = this.noise(nx * 3, nz * 3);
                map[x][z] = Math.floor(noise * 5 + 3);
            }
        }
        return map;
    }

    noise(x, y) {
        return Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
    }

    getBlockType(y, maxHeight) {
        if (y === maxHeight) return y < 3 ? 2 : 1; // Grass or sand
        if (y > maxHeight - 3) return 3; // Dirt
        return 4; // Stone
    }

    placeBlock(x, y, z, type) {
        const key = `${x},${y},${z}`;
        if (this.blocks.has(key)) return;

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const materials = [
            new THREE.MeshLambertMaterial({ color: 0x8B4513 }), // Wood
            new THREE.MeshLambertMaterial({ color: 0x228B22 }), // Grass
            new THREE.MeshLambertMaterial({ color: 0xD2691E }), // Dirt
            new THREE.MeshLambertMaterial({ color: 0x696969 }), // Stone
            new THREE.MeshLambertMaterial({ color: 0x4169E1 }), // Water
            new THREE.MeshLambertMaterial({ color: 0xFF6347 })  // Lava
        ];
        
        const block = new THREE.Mesh(geometry, materials[type]);
        block.position.set(x + 0.5, y + 0.5, z + 0.5);
        block.castShadow = true;
        block.receiveShadow = true;
        block.userData = { type, position: { x, y, z } };
        
        this.scene.add(block);
        this.blocks.set(key, block);
    }

    removeBlock(x, y, z) {
        const key = `${x},${y},${z}`;
        const block = this.blocks.get(key);
        if (block) {
            this.scene.remove(block);
            block.geometry.dispose();
            block.material.dispose();
            this.blocks.delete(key);
        }
    }

    setupPlayer() {
        this.camera.position.set(0, 10, 0);
        this.velocity = new THREE.Vector3();
        this.onGround = false;
    }

    setupControls() {
        // Keyboard controls
        this.keys = {};
        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);

        // Mobile joystick
        if (window.innerWidth <= 768) {
            this.joystick = nipplejs.create({
                zone: document.getElementById('joystick'),
                mode: 'static',
                position: { left: '60px', bottom: '60px' },
                size: 80
            });
        }

        // Touch controls
        this.setupTouchControls();
    }

    setupTouchControls() {
        const placeBtn = document.getElementById('placeBtn');
        const breakBtn = document.getElementById('breakBtn');
        const jumpBtn = document.getElementById('jumpBtn');

        placeBtn.addEventListener('touchstart', () => this.placeBlockAtCrosshair());
        breakBtn.addEventListener('touchstart', () => this.breakBlockAtCrosshair());
        jumpBtn.addEventListener('touchstart', () => this.jump());
    }

    updateMovement(delta) {
        const speed = 5;
        const moveVector = new THREE.Vector3();

        // Keyboard movement
        if (this.keys['KeyW']) moveVector.z -= 1;
        if (this.keys['KeyS']) moveVector.z += 1;
        if (this.keys['KeyA']) moveVector.x -= 1;
        if (this.keys['KeyD']) moveVector.x += 1;

        // Joystick movement
        if (this.joystick) {
            const data = this.joystick.getData();
            if (data.vector) {
                moveVector.x = data.vector.x;
                moveVector.z = -data.vector.y;
            }
        }

        moveVector.normalize().multiplyScalar(speed * delta);
        
        // Apply movement
        this.camera.position.x += moveVector.x;
        this.camera.position.z += moveVector.z;

        // Gravity
        this.velocity.y -= 20 * delta;
        this.camera.position.y += this.velocity.y * delta;

        // Ground collision
        if (this.camera.position.y < 2) {
            this.camera.position.y = 2;
            this.velocity.y = 0;
            this.onGround = true;
        }
    }

    jump() {
        if (this.onGround) {
            this.velocity.y = 8;
            this.onGround = false;
        }
    }

    setupUI() {
        document.getElementById('loading').style.display = 'none';
        
        // Hotbar selection
        document.querySelectorAll('.hotbar-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                document.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
                slot.classList.add('active');
            });
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = 0.016;
        this.updateMovement(delta);
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize game
new MinecraftClone();

