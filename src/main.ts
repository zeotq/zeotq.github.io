import * as THREE from 'three';
import { Trail } from './Trail';
import './style.css'

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Защита от просадок на большом разрешении
document.body.appendChild(renderer.domElement);


const radius = 4;
let theta = 0;
let phi = Math.PI / 3;

const earthGeometry = new THREE.BoxGeometry();
const moonGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const appoloGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);

const material = new THREE.MeshNormalMaterial();
const earth = new THREE.Mesh(earthGeometry, material);
const moonAnchor = new THREE.Object3D();
const moon = new THREE.Mesh(moonGeometry, material);
const appolo = new THREE.Mesh(appoloGeometry, material);
const moonOrbit = new THREE.Object3D();
const appoloOrbit = new THREE.Object3D();

const moonTrail  = new Trail({ color: 0xaaaaaa, maxPoints: 600 }).addTo(scene);
const appoloTrail = new Trail({ color: 0x66ccff, maxPoints: 600 }).addTo(scene);

moonAnchor.position.set(0, 2, 0);
appolo.position.set(0, 1, 0);

scene.add(earth);
moonAnchor.add(moonOrbit);
moonOrbit.add(moon);
earth.add(moonAnchor);
moonAnchor.add(appoloOrbit);
appoloOrbit.add(appolo);

camera.position.z = 4;

function tick(t: number) {
  requestAnimationFrame(tick);

  earth.rotation.z += 0.002;
  moonOrbit.rotation.z += 0.01;
  const s = t * 0.001;
  moon.rotation.set(
    Math.sin(s * 1.7) * 2.0 + Math.sin(s * 5.3) * 0.5,
    Math.sin(s * 2.3) * 3.0 + Math.sin(s * 7.1) * 0.7,
    Math.sin(s * 1.1) * 1.5 + Math.sin(s * 3.9) * 0.4
  );
  appoloOrbit.rotation.x += 0.01;
  appolo.rotation.z += 0.005;

  moonTrail.update(moon);
  appoloTrail.update(appolo);

  theta += 0.01;
  phi = Math.PI / 2 + Math.sin(theta * 0.5) * (Math.PI / 3);

  camera.position.x = radius * Math.sin(phi) * Math.cos(theta);
  camera.position.y = radius * Math.cos(phi);
  camera.position.z = radius * Math.sin(phi) * Math.sin(theta);

  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

tick(performance.now());

// Обработка изменения размера окна
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
