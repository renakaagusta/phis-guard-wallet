import { JSX } from 'preact/jsx-runtime'
import { EthereumBytes32 } from '../../types/wire-types.js'
import { bytes32String } from '../../utils/bigint.js'

type NameHashComponentParams = {
	readonly type: 'nameHash' | 'labelHash'
	readonly nameHash: EthereumBytes32,
	readonly name: string | undefined,
	readonly style?: JSX.CSSProperties
	readonly addDotEth?: boolean
}

export const EnsNamedHashComponent = (params: NameHashComponentParams) => {
	const name = params.name !== undefined ? (params.addDotEth ? `${ params.name }.eth` : params.name) : bytes32String(params.nameHash)
	return (
		<span className = 'small-address-container' data-value = { name }>
			
		</span>
	)
}
