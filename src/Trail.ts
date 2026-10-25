
import * as THREE from 'three';

export interface TrailOptions {
  color?: THREE.ColorRepresentation;
  colors?: THREE.ColorRepresentation[];
  maxPoints?: number;
  opacity?: number;
  radius?: number;
  radialSegments?: number;
  pulseSpeed?: number;
  pulseAmount?: number;
  colorSpeed?: number;
  fade?: boolean;
  additive?: boolean;
}

export class Trail {
  readonly line: THREE.Group;

  private readonly maxPoints: number;
  private readonly radialSegments: number;
  private readonly positions: THREE.Vector3[] = [];
  private readonly colors: THREE.Color[];
  private readonly radius: number;
  private readonly opacity: number;
  private readonly pulseSpeed: number;
  private readonly pulseAmount: number;
  private readonly colorSpeed: number;
  private readonly fade: boolean;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.MeshBasicMaterial[] = [];
  private readonly meshes: THREE.Mesh[] = [];
  private readonly tmp = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly binormal = new THREE.Vector3();
  private readonly color = new THREE.Color();

  private readonly baseColor: THREE.Color;
  private elapsed = 0;

  constructor(options: TrailOptions = {}) {
    const {
      color = 0x66ccff,
      colors = [color, 0x9966ff, 0xff66cc, color],
      maxPoints = 400,
      opacity = 0.7,
      radius = 0.055,
      radialSegments = 8,
      pulseSpeed = 3,
      pulseAmount = 0.3,
      colorSpeed = 0.25,
      fade = true,
      additive = true,
    } = options;

    this.maxPoints = Math.max(2, Math.floor(maxPoints));
    this.radialSegments = Math.max(3, Math.floor(radialSegments));
    this.radius = radius;
    this.opacity = opacity;
    this.pulseSpeed = pulseSpeed;
    this.pulseAmount = pulseAmount;
    this.colorSpeed = colorSpeed;
    this.fade = fade;
    this.baseColor = new THREE.Color(color);
    this.colors = colors.map(c => new THREE.Color(c));

    this.line = new THREE.Group();

    const layers = [
      { scale: 3.0, opacity: 0.10 },
      { scale: 1.8, opacity: 0.20 },
      { scale: 1.0, opacity: 1.0 },
    ];

    for (const layer of layers) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        opacity: opacity * layer.opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        toneMapped: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 10;

      this.geometries.push(geometry);
      this.materials.push(material);
      this.meshes.push(mesh);
      this.line.add(mesh);
    }
  }

  update(source: THREE.Object3D, deltaTime = 1 / 60): void {
    this.elapsed += Math.max(0, deltaTime);

    source.getWorldPosition(this.tmp);

    const last = this.positions[this.positions.length - 1];

    if (!last || last.distanceToSquared(this.tmp) > 0.000001) {
      this.positions.push(this.tmp.clone());

      if (this.positions.length > this.maxPoints) {
        this.positions.shift();
      }
    }

    this.rebuild();
    this.animate();
  }

  private rebuild(): void {
    const count = this.positions.length;

    if (count < 2) {
      for (const geometry of this.geometries) {
        geometry.setDrawRange(0, 0);
      }
      return;
    }

    const rings = count;
    const sides = this.radialSegments;
    const verticesPerRing = sides + 1;
    const vertexCount = rings * verticesPerRing;
    const indexCount = (rings - 1) * sides * 6;

    for (let layerIndex = 0; layerIndex < this.geometries.length; layerIndex++) {
      const geometry = this.geometries[layerIndex];
      const scale = [3.0, 1.8, 1.0][layerIndex];

      const positions = new Float32Array(vertexCount * 3);
      const vertexColors = new Float32Array(vertexCount * 3);
      const indices: number[] = [];

      for (let i = 0; i < rings; i++) {
        const point = this.positions[i];
        const previous = this.positions[Math.max(0, i - 1)];
        const next = this.positions[Math.min(rings - 1, i + 1)];

        this.tangent.subVectors(next, previous).normalize();

        if (this.tangent.lengthSq() < 0.000001) {
          this.tangent.set(0, 1, 0);
        }

        this.normal.set(0, 1, 0);

        if (Math.abs(this.tangent.dot(this.normal)) > 0.95) {
          this.normal.set(1, 0, 0);
        }

        this.binormal.crossVectors(this.tangent, this.normal).normalize();
        this.normal.crossVectors(this.binormal, this.tangent).normalize();

        const age = i / (rings - 1);
        const colorPosition =
          (this.elapsed * this.colorSpeed + age) *
          Math.max(1, this.colors.length - 1);

        const colorIndex = Math.floor(colorPosition) % this.colors.length;
        const nextColorIndex = (colorIndex + 1) % this.colors.length;
        const colorMix = colorPosition - Math.floor(colorPosition);

        this.color.copy(this.colors[colorIndex]).lerp(
          this.colors[nextColorIndex],
          colorMix,
        );

        if (this.colors.length === 1) {
          this.color.copy(this.baseColor);
        }

        if (this.fade) {
          this.color.multiplyScalar(0.15 + age * 0.85);
        }

        const pulse =
          1 + this.pulseAmount *
          Math.sin(this.elapsed * this.pulseSpeed - age * 5);

        const r = this.radius * scale * pulse;

        for (let j = 0; j <= sides; j++) {
          const angle = (j / sides) * Math.PI * 2;
          const c = Math.cos(angle);
          const s = Math.sin(angle);

          const x = point.x + r * (this.normal.x * c + this.binormal.x * s);
          const y = point.y + r * (this.normal.y * c + this.binormal.y * s);
          const z = point.z + r * (this.normal.z * c + this.binormal.z * s);

          const vertexIndex = (i * verticesPerRing + j) * 3;

          positions[vertexIndex] = x;
          positions[vertexIndex + 1] = y;
          positions[vertexIndex + 2] = z;

          vertexColors[vertexIndex] = this.color.r;
          vertexColors[vertexIndex + 1] = this.color.g;
          vertexColors[vertexIndex + 2] = this.color.b;
        }
      }

      for (let i = 0; i < rings - 1; i++) {
        for (let j = 0; j < sides; j++) {
          const a = i * verticesPerRing + j;
          const b = a + verticesPerRing;
          const c = a + 1;
          const d = b + 1;

          indices.push(a, b, c, c, b, d);
        }
      }

      geometry.dispose();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(vertexColors, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      geometry.setDrawRange(0, indexCount);
    }
  }

  private animate(): void {
    const pulse =
      1 + this.pulseAmount * Math.sin(this.elapsed * this.pulseSpeed);

    this.materials[0].opacity = this.opacity * 0.10 * pulse;
    this.materials[1].opacity = this.opacity * 0.20 * pulse;
    this.materials[2].opacity = this.opacity;
  }

  addTo(parent: THREE.Object3D): this {
    parent.add(this.line);
    return this;
  }

  clear(): void {
    this.positions.length = 0;

    for (const geometry of this.geometries) {
      geometry.setDrawRange(0, 0);
    }
  }

  dispose(): void {
    for (const geometry of this.geometries) {
      geometry.dispose();
    }

    for (const material of this.materials) {
      material.dispose();
    }

    this.line.removeFromParent();
  }
}
