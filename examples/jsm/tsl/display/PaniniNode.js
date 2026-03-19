import { TempNode } from 'three/webgpu';
import { 
	nodeObject, Fn, float, uniform, vec3, vec4, mix,
	mul, uv, sqrt, normalize
	 } from 'three/tsl';

/**
 * A post processing node for color grading via lookup tables.
 *
 * @augments TempNode
 * @three_import import { lut3D } from 'three/addons/tsl/display/Lut3DNode.js';
 */
class PaniniNode extends TempNode {

	static get type() {

		return 'PaniniNode';

	}

	/**
	 * Constructs a new LUT node.
	 *
	 * @param {Node} inputNode - The node that represents the input of the effect.
	 * @param {TextureNode} lutNode - A texture node that represents the lookup table.
	 * @param {number} size - The size of the lookup table.
	 * @param {Node<float>} intensityNode - Controls the intensity of the effect.
	 */
	constructor( inputNode, lutNode, size, intensityNode ) {

		super( 'vec4' );

		/**
		 * The node that represents the input of the effect.
		 *
		 * @type {Node}
		 */
		this.inputNode = inputNode;

		/**
		 * A texture node that represents the lookup table.
		 *
		 * @type {TextureNode}
		 */
		this.lutNode = lutNode;

		/**
		 * The size of the lookup table.
		 *
		 * @type {UniformNode<float>}
		 */
		this.size = uniform( size );

		/**
		 * Controls the intensity of the effect.
		 *
		 * @type {Node<float>}
		 */
		this.intensityNode = intensityNode;

	}

	/**
	 * This method is used to setup the effect's TSL code.
	 *
	 * @param {NodeBuilder} builder - The current node builder.
	 * @return {ShaderCallNodeInternal}
	 */
	setup() {

		const { inputNode, lutNode } = this;

		//const sampleLut = ( uv ) => lutNode.sample( uv );

		const Panini = Fn( ([coord = uv()]) => {

			const base = inputNode;


			// Normalize fragment coordinates to a range of [-aspect, +aspect] and [-1, +1]
			const iResolution = vec3(1000.0,200.0,0.0);

            const uv = mul( 2.0, coord ).sub( iResolution.xy ).div( iResolution.y );

			// Fixed parameter for the Panini projection
			// k controls the "curvature" of the projection
			// Try other values (e.g. 1.5, 0.8, etc.) to see different Panini distortion strengths

			const k = float( 1.0 );

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

			// Normalize the ray direction to ensure proper sampling

			rayDirection.assign( normalize( rayDirection ) );

			// -----------------------------------------------
			// Step 3: Sample the texture using the ray direction
			// -----------------------------------------------
			// Sample the texture (equirectangular map assumed) using the ray direction

			const color = base.sample( rayDirection ).xyz;

			return vec4( color, 1.0 );

		} );

		const outputNode = Panini();

		return outputNode;

	}

}

export default PaniniNode;

/**
 * TSL function for creating a LUT node for color grading via post processing.
 *
 * @tsl
 * @function
 * @param {Node} node - The node that represents the input of the effect.
 * @param {TextureNode} lut - A texture node that represents the lookup table.
 * @param {number} size - The size of the lookup table.
 * @param {Node<float> | number} intensity - Controls the intensity of the effect.
 * @returns {Lut3DNode}
 */
export const Panini = ( node, lut, size, intensity ) => new PaniniNode( nodeObject( node ), nodeObject( lut ), size, nodeObject( intensity ) );
