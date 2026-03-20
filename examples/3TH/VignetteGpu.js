import { PlaneGeometry, NodeMaterial, Mesh  } from 'three/webgpu';


import { 
	attribute, color, uniform, uniformCubeTexture, vec2, vec3, uv, dot, smoothstep, sub, float, vec4, sin, fract, add, If, Fn, clamp,
	cos, mat2, mul, exp, sqrt, PI, normalize, asin, fwidth, round, abs, atan, mod
} from 'three/tsl';


///

export class VignetteGpu extends Mesh {

    constructor( o = {} ) {

        const geometry = new PlaneGeometry( 2, 2, 1, 1 );
        const material = new NodeMaterial();

        super(geometry, material);

        this._ratio = uniform( 1.0 );
        this.mouse = uniform( vec3( 0.0,0.0,0.0 ) );
        this.cube = uniformCubeTexture( 'cube' );
        this._curvature = uniform( 1 );
        this._grid = uniform( 0 )



        this._color = uniform( color( '#010101' ) );
        this._offset = uniform( 1.05 );
        this._darkness = uniform( 0.5 );
        this._grain = uniform( 1.0 ); 

        
        const rotate = /*@__PURE__*/ Fn( ( [ v, a ] ) => {

			const s = sin( a );
			const c = cos( a );
			const m = mat2( c, s, s.negate(), c );

			return m.mul( v );

		}, { v: 'vec2', a: 'float', return: 'vec2' } );

        //screenUV//

        const uv0 = uv();
        const self = this

        const position = attribute("position")
        this.material.vertexNode = vec4( position, 1.0 );


        this.material.colorNode = Fn( () => {

        	const res = vec2( 1.0, this._ratio )
        	const res2 = vec2( self._offset )
        	const m = self.mouse

            const uv = vec2( uv0.sub( vec2( 0.5 ) ).mul( res ) ).toVar();
            const uv2 = vec2( uv0.sub( vec2( 0.5 ) ).mul( res2 ) ).toVar();

            // zoom
            //uv.mulAssign( exp( iWheel ) );
            uv.mulAssign( exp( m.z ) );

            // Fixed parameter for the Panini projection
			// k controls the "curvature" of the projection
			// Try other values (e.g. 1.5, 0.8, etc.) to see different Panini distortion strengths

			const k = self._curvature;//float( 1.0 );

			// -----------------------------------------------
			// Step 1: Solve for the intersection with the cylinder
			// -----------------------------------------------
			// Quadratic equation coefficients

			const A = uv.x.mul( uv.x ).add( k.add( 1.0 ).mul( k.add( 1.0 ) ) );
			const B = k.mul( k.add( 1.0 ) );
			const C = k.mul( k ).sub( 1.0 );

			// Solve the quadratic equation for t
			// t is the distance scaling factor to reach the cylinder surface

			const t = B.add( sqrt( B.mul( B ).sub( A.mul( C ) ) ) ).div( A );

			// -----------------------------------------------
			// Step 2: Compute the ray direction
			// -----------------------------------------------
			// The ray direction intersects the virtual cylinder at this point

			const rayDirection = vec3( t.mul( uv ), t.mul( k.add( 1.0 ) ).sub( k ) );
			rayDirection.xz.assign( rotate( rayDirection.xz, float(- 0.5).mul( PI ) ) );

			
			//
			rayDirection.xy.assign( rotate( rayDirection.xy, m.y ) );
			rayDirection.xz.assign( rotate( rayDirection.xz, m.x ) );



			// Normalize the ray direction to ensure proper sampling
			rayDirection.assign( normalize( rayDirection ) );

			const col = self.cube.sample( rayDirection ).rgb.toVar();


			// grid
			If( self._grid.notEqual( 0.0 ), () => {
				const phi = asin( rayDirection.y ).div( PI );
				const nsteps = float( 12.0 );
				phi.mulAssign( nsteps );
				col.mulAssign( add( 0.6, mul( 0.4, smoothstep( 0.0, fwidth( phi ), abs( phi.sub( round( phi ) ) ) ) ) ) );
				const lambda = atan( rayDirection.x, rayDirection.z ).div( PI );
				const dlambda = fwidth( lambda );
				const lambda1 = mod( lambda, 2.0 );
				const dlambda1 = fwidth( lambda1 );
				dlambda.assign( dlambda1 );
				lambda.mulAssign( nsteps );
				dlambda.mulAssign( nsteps );
				col.mulAssign( add( 0.6, mul( 0.4, smoothstep( 0.0, dlambda, abs( lambda.sub( round( lambda ) ) ) ) ) ) );
			})


			/// vignette

            const alpha = float( smoothstep( 0.0, 1.0, dot( uv2, uv2 ) ).sub( sub( 1.0, self._darkness ) ) ).toVar();
            const overlay = smoothstep(vec3(1.0), self._color,  alpha).toVar();

            // film grain noise
            If( self._grain.notEqual( 0.0 ), () => {

                const noise = float( fract( sin( dot( uv2, vec2( 12.9898, 78.233 ).mul( 2.0 ) ) ).mul( 43758.5453 ) ) );
                const alphaAdd = ( noise.mul( self._grain ).mul( add( 0.5, alpha ) ) ).toVar();
                overlay.assign( smoothstep(vec3(1.0), self._color,  clamp(alpha.add(alphaAdd), 0.0, 1.0 ) ) );

            })

            //const color = vec4( smoothstep(col, self._color, alpha), 1.0 );

            const color = vec4( col, 1.0 ).mul(overlay);

            return color;

        } )();

        this.material.transparent = false
        this.material.depthWrite = false
        this.material.depthTest = false
        this.material.dithering = false
        this.material.toneMapped = false
 
        Object.defineProperties(this, {

        	ratio: {
                enumerable: true,
                get: () => ( this._ratio.value ),
                set: ( v ) => { this._ratio.value = v },
            },

        	curvature: {
                enumerable: true,
                get: () => ( this._curvature.value ),
                set: ( v ) => { this._curvature.value = v  },
            },

            grid: {
                enumerable: true,
                get: () => ( this._grid.value > 0.0 ? true: false ),
                set: ( v ) => { this._grid.value = v === true ? 1.0 : 0.0; },
            },

            color: {
                enumerable: true,
                //get: ( v ) => { console.log(this._color); return this._color.value.getHex(); },
                get: () => ( this._color.value.getHex() ),
                set: ( v ) => { this._color.value.setHex( v ) },
            },
            offset: {
                enumerable: true,
                get: () => ( this._offset.value ),
                set: ( v ) => { this._offset.value = v },
            },
            darkness: {
                enumerable: true,
                get: () => ( this._darkness.value ),
                set: ( v ) => { this._darkness.value = v },
            },
            grain: {
                enumerable: true,
                get: () => ( this._grain.value ),
                set: ( v ) => { this._grain.value = v },
            },
        })

        this.frustumCulled = false;
        this.renderOrder = 10000;
        this.matrixAutoUpdate = false;

    }

    raycast() {

        return

    }

    dispose () {

        this.parent.remove(this);
        this.geometry.dispose()
        this.material.dispose()
        
    }

}