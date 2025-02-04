import * as funtypes from 'funtypes'
import { ModifyAddressWindowState } from './visualizer-types.js'
import { EthereumAddress, LiteralConverterParserFactory } from './wire-types.js'

export type Page = funtypes.Static<typeof Page>
export const Page = funtypes.Union(
	funtypes.ReadonlyObject({ page: funtypes.Literal('Home') }),
	funtypes.ReadonlyObject({ page: funtypes.Literal('AddNewAddress'), state: ModifyAddressWindowState }),
	funtypes.ReadonlyObject({ page: funtypes.Literal('ModifyAddress'), state: ModifyAddressWindowState }),
	funtypes.ReadonlyObject({ page: funtypes.Literal('ChangeActiveAddress') }),
	funtypes.ReadonlyObject({ page: funtypes.Literal('AccessList') }),
	funtypes.ReadonlyObject({ page: funtypes.Literal('Settings') }),
)

export type ActiveAddress = funtypes.Static<typeof ActiveAddress>
export const ActiveAddress = funtypes.ReadonlyObject({
	name: funtypes.String,
	address: EthereumAddress,
	askForAddressAccess: funtypes.Union(funtypes.Boolean, funtypes.Literal(undefined).withParser(LiteralConverterParserFactory(undefined, true))),
}).asReadonly()
