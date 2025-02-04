import { useEffect, useState } from 'preact/hooks'
import { AddressBookEntries, AddressBookEntry } from '../../types/addressBookTypes.js'
import { FirstCardParams, HomeParams, TabIconDetails, TabState } from '../../types/user-interface-types.js'
import { DEFAULT_TAB_CONNECTION } from '../../utils/constants.js'
import { ActiveAddressComponent, getActiveAddressEntry } from '../subcomponents/address.js'
import { RpcSelector } from '../subcomponents/ChainSelector.js'
import { DinoSays } from '../subcomponents/DinoSays.js'
import { ErrorComponent } from '../subcomponents/Error.js'
import { getPrettySignerName } from '../subcomponents/signers.js'

type SignerExplanationParams = {
	activeAddress: AddressBookEntry | undefined
	tabState: TabState | undefined
	useSignersAddressAsActiveAddress: boolean
}

function SignerExplanation(param: SignerExplanationParams) {
	if (param.activeAddress !== undefined || param.tabState === undefined || param.tabState.signerAccountError !== undefined) return <></>
	if (!param.tabState.signerConnected) {
		if (param.tabState.signerName === 'NoSignerDetected' || param.tabState.signerName === 'NoSigner') return <ErrorComponent text='No signer installed. You need to install a signer, eg. Metamask.' />
		return <ErrorComponent text='The page you are looking at has NOT CONNECTED to a wallet.' />
	}
	return <ErrorComponent text={`No account connected (or wallet is locked) in ${param.tabState.signerName === 'NoSigner' ? 'signer' : getPrettySignerName(param.tabState.signerName)}.`} />
}

function FirstCard(param: FirstCardParams) {
	if (param.tabState?.signerName === 'NoSigner') {
		return <>
			<section class='card' style='margin: 10px;'>
				<header class='px-3 py-2' style={{ display: 'grid', gridTemplateColumns: 'max-content max-content minmax(0, 1fr)', columnGap: '1rem', alignItems: 'center' }}>
					<div>
						<RpcSelector rpcEntries={param.rpcEntries} rpcNetwork={param.rpcNetwork} changeRpc={param.changeActiveRpc} />
					</div>
				</header>
				<div class='card-content'>
					<DinoSays text={'No signer connnected. You can use Interceptor in simulation mode without a signer, but signing mode requires a browser wallet.'} />
				</div>
			</section>
		</>
	}

	return <>
		<section class='card' style='margin: 10px;'>
			<header class='px-3 py-2' style={{ display: 'grid', gridTemplateColumns: 'max-content max-content minmax(0, 1fr)', columnGap: '1rem', alignItems: 'center' }}>
				<div>
					<RpcSelector rpcEntries={param.rpcEntries} rpcNetwork={param.rpcNetwork} changeRpc={param.changeActiveRpc} />
				</div>
			</header>
			<div class='card-content'>
				{param.useSignersAddressAsActiveAddress ?
					<p style='color: var(--text-color); text-align: left; padding-bottom: 10px'>
						{param.tabState?.signerConnected ? <span style='float: right; color: var(--primary-color);'>CONNECTED</span> : <span style='float: right; color: var(--negative-color);'>NOT CONNECTED</span>}
					</p>
					: <></>
				}

				<ActiveAddressComponent
					activeAddress={param.activeAddress}
					buttonText={'Change'}
					changeActiveAddress={param.changeActiveAddress}
					renameAddressCallBack={param.renameAddressCallBack}
				/>

			</div>
		</section>

		<SignerExplanation
			activeAddress={param.activeAddress}
			tabState={param.tabState}
			useSignersAddressAsActiveAddress={param.useSignersAddressAsActiveAddress}
		/>
	</>
}

export function Home(param: HomeParams) {
	const [activeSigningAddress, setActiveSigningAddress] = useState<AddressBookEntry | undefined>(undefined)
	const [useSignersAddressAsActiveAddress, setUseSignersAddressAsActiveAddress] = useState(false)
	const [tabIconDetails, setTabConnection] = useState<TabIconDetails>(DEFAULT_TAB_CONNECTION)
	const [tabState, setTabState] = useState<TabState | undefined>(undefined)
	const [isLoaded, setLoaded] = useState<boolean>(false)
	const [activeAddresses, setActiveAddresses] = useState<AddressBookEntries>([])

	useEffect(() => {
		setUseSignersAddressAsActiveAddress(param.useSignersAddressAsActiveAddress)
		setActiveSigningAddress(param.activeSigningAddress !== undefined ? getActiveAddressEntry(param.activeSigningAddress, param.activeAddresses) : undefined)
		setTabConnection(param.tabIconDetails)
		setTabState(param.tabState)
		setActiveAddresses(param.activeAddresses)
		setLoaded(true)
	}, [param.activeSigningAddress,
	param.tabState,
	param.activeAddresses,
	param.useSignersAddressAsActiveAddress,
	param.rpcNetwork.value,
	param.tabIconDetails,
	param.currentBlockNumber,
	param.simVisResults,
	param.rpcConnectionStatus,
	param.simulationUpdatingState,
	param.simulationResultState,
	])

	if (!isLoaded || param.rpcNetwork.value === undefined) return <> </>

	return <>
		{param.rpcNetwork.value.httpsRpc === undefined ?
			<ErrorComponent text={`${param.rpcNetwork.value.name} is not a supported network. PhisGuard is disabled while you are using ${param.rpcNetwork.value.name}.`} />
			: <></>}

		<FirstCard
			activeAddresses={activeAddresses}
			useSignersAddressAsActiveAddress={useSignersAddressAsActiveAddress}
			activeAddress={activeSigningAddress}
			rpcNetwork={param.rpcNetwork}
			changeActiveRpc={param.setActiveRpcAndInformAboutIt}
			changeActiveAddress={param.changeActiveAddress}
			tabState={tabState}
			tabIconDetails={tabIconDetails}
			renameAddressCallBack={param.renameAddressCallBack}
			rpcEntries={param.rpcEntries}
		/>
	</>
}
