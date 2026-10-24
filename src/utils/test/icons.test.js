import { createIcons, getIconSvg, parseIconName } from '../icons';

describe( 'parseIconName()', () => {
	it.each( [
		[ 'fa:fa-car', { pack: 'fa', icon: 'car' } ],
		[ 'fab:fa-github', { pack: 'fab', icon: 'github' } ],
		[ 'far:fa-user', { pack: 'far', icon: 'user' } ],
		[ 'fa:user', { pack: 'fa', icon: 'user' } ],
		[ 'logos:aws', { pack: 'logos', icon: 'aws' } ],
		[ 'logos:aws-lambda', { pack: 'logos', icon: 'aws-lambda' } ],
	] )( 'reads %s', ( name, expected ) => {
		expect( parseIconName( name ) ).toEqual( expected );
	} );

	it.each( [ 'database', 'server', '', ':x', 'fa:', 'a:b:c', 'Fa:car' ] )(
		'finds no pack in "%s"',
		( name ) => {
			expect( parseIconName( name ) ).toBeNull();
		}
	);
} );

describe( 'getIconSvg()', () => {
	const pack = {
		prefix: 'p',
		width: 640,
		height: 512,
		icons: {
			car: { body: '<path d="M0 0"/>' },
			wide: { body: '<g/>', width: 32, left: 2 },
			plain: { body: '<rect/>', width: 24, height: 24, top: 1 },
		},
		aliases: {
			auto: { parent: 'car' },
			tall: { parent: 'wide', height: 48 },
			orphan: { parent: 'nowhere' },
			chain: { parent: 'auto' },
		},
	};
	const svg = ( box, body ) =>
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ box }" width="100%" height="100%" fill="currentColor" stroke="none">${ body }</svg>`;

	it( 'uses the size of the pack for an icon with none', () => {
		expect( getIconSvg( pack, 'car' ) ).toBe(
			svg( '0 0 640 512', '<path d="M0 0"/>' )
		);
	} );

	it( 'lets an icon override width, height, left and top', () => {
		expect( getIconSvg( pack, 'wide' ) ).toBe(
			svg( '2 0 32 512', '<g/>' )
		);
		expect( getIconSvg( pack, 'plain' ) ).toBe(
			svg( '0 1 24 24', '<rect/>' )
		);
	} );

	it( 'uses 16 by 16 when neither the icon nor the pack has a size', () => {
		expect( getIconSvg( { icons: { a: { body: '<i/>' } } }, 'a' ) ).toBe(
			svg( '0 0 16 16', '<i/>' )
		);
	} );

	it( 'follows an alias to its parent, which it may override', () => {
		expect( getIconSvg( pack, 'auto' ) ).toBe( getIconSvg( pack, 'car' ) );
		expect( getIconSvg( pack, 'tall' ) ).toBe( svg( '2 0 32 48', '<g/>' ) );
	} );

	it.each( [ 'missing', 'orphan', 'chain', '__proto__', 'constructor' ] )(
		'returns null for %s',
		( icon ) => {
			expect( getIconSvg( pack, icon ) ).toBeNull();
		}
	);

	it( 'returns null for a file that is no icon set', () => {
		expect( getIconSvg( null, 'car' ) ).toBeNull();
		expect( getIconSvg( { icons: 'x' }, 'car' ) ).toBeNull();
		expect( getIconSvg( { icons: { a: {} } }, 'a' ) ).toBeNull();
	} );
} );

describe( 'createIcons()', () => {
	const fa = { prefix: 'fa', icons: { car: { body: '<path/>' } } };
	let n = 0;

	const respond = ( data, ok = true ) =>
		Promise.resolve( { ok, json: () => Promise.resolve( data ) } );

	beforeEach( () => {
		n++;
		global.fetch = jest.fn( () => respond( fa ) );
		jest.spyOn( console, 'error' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete global.fetch;
	} );

	it( 'knows nothing of an icon before its pack is loaded', () => {
		const icons = createIcons( { fa: `/fa-${ n }.json` } );

		expect( icons.get( 'fa:fa-car' ) ).toBeNull();
		expect( global.fetch ).not.toHaveBeenCalled();
	} );

	it( 'asks to load only the packs that names point at', () => {
		const icons = createIcons( { fa: `/fa-${ n }.json` } );

		expect( icons.hasUnloaded( [ 'database', 'server' ] ) ).toBe( false );
		expect( icons.hasUnloaded( [ 'other:car' ] ) ).toBe( false );
		expect( icons.hasUnloaded( [ 'database', 'fa:fa-car' ] ) ).toBe( true );
	} );

	it( 'gives the SVG of an icon once its pack is loaded', async () => {
		const icons = createIcons( { fa: `/fa-${ n }.json` } );

		await icons.load( [ 'fa:fa-car' ] );

		expect( icons.get( 'fa:fa-car' ) ).toContain( '<path/>' );
		expect( icons.get( 'fa:truck' ) ).toBeNull();
		expect( icons.hasUnloaded( [ 'fa:fa-car' ] ) ).toBe( false );
	} );

	it( 'fetches a pack once, for any number of icons and users', async () => {
		const url = `/fa-${ n }.json`;
		const one = createIcons( { fa: url } );
		const two = createIcons( { fa: url } );

		await Promise.all( [
			one.load( [ 'fa:fa-car', 'fa:user' ] ),
			two.load( [ 'fa:fa-car' ] ),
		] );
		await one.load( [ 'fa:fa-car' ] );

		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
		expect( global.fetch ).toHaveBeenCalledWith( url );
	} );

	it( 'leaves the icons of a pack that failed to load out, and says so once', async () => {
		global.fetch = jest.fn( () => respond( null, false ) );
		const url = `/fa-${ n }.json`;
		const icons = createIcons( { fa: url } );

		await expect( icons.load( [ 'fa:fa-car' ] ) ).resolves.toBeUndefined();
		await icons.load( [ 'fa:fa-car' ] );

		expect( icons.get( 'fa:fa-car' ) ).toBeNull();
		expect( icons.hasUnloaded( [ 'fa:fa-car' ] ) ).toBe( false );
		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
		// eslint-disable-next-line no-console
		expect( console.error ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'treats a fetch that rejects, or a file that is no JSON, as a failure', async () => {
		global.fetch = jest.fn( () =>
			Promise.reject( new Error( 'offline' ) )
		);
		const icons = createIcons( { fa: `/fa-${ n }.json` } );

		await expect( icons.load( [ 'fa:fa-car' ] ) ).resolves.toBeUndefined();

		expect( icons.get( 'fa:fa-car' ) ).toBeNull();
	} );
} );
