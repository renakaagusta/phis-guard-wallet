import { useEffect, useState } from 'preact/hooks'
import { sendPopupMessageToBackgroundPage } from '../../background/backgroundUtils.js'
import { AddressBookEntries, AddressBookEntry } from '../../types/addressBookTypes.js'
import { FirstCardParams, HomeParams, TabIcon, TabIconDetails, TabState } from '../../types/user-interface-types.js'
import { DEFAULT_TAB_CONNECTION, ICON_NOT_ACTIVE, ICON_NOT_ACTIVE_WITH_SHIELD } from '../../utils/constants.js'
import { ActiveAddressComponent, getActiveAddressEntry } from '../subcomponents/address.js'
import { RpcSelector } from '../subcomponents/ChainSelector.js'
import { DinoSays } from '../subcomponents/DinoSays.js'
import { ErrorComponent } from '../subcomponents/Error.js'
import { getPrettySignerName, SignerLogoText, SignersLogoName } from '../subcomponents/signers.js'

type SignerExplanationParams = {
	activeAddress: AddressBookEntry | undefined
	simulationMode: boolean
	tabState: TabState | undefined
	useSignersAddressAsActiveAddress: boolean
	tabIcon: TabIcon
}

function SignerExplanation(param: SignerExplanationParams) {
	if (param.activeAddress !== undefined || param.tabState === undefined || param.tabState.signerAccountError !== undefined) return <></>
	if (!param.tabState.signerConnected) {
		if (param.tabState.signerName === 'NoSignerDetected' || param.tabState.signerName === 'NoSigner') return <ErrorComponent text='No signer installed. You need to install a signer, eg. Metamask.' />
		return <ErrorComponent text='The page you are looking at has NOT CONNECTED to a wallet.' />
	}
	return <ErrorComponent text={`No account connected (or wallet is locked) in ${param.tabState.signerName === 'NoSigner' ? 'signer' : getPrettySignerName(param.tabState.signerName)}.`} />
}

function FirstCardHeader(param: FirstCardParams) {
	return <>
		<header class='px-3 py-2' style={{ display: 'grid', gridTemplateColumns: 'max-content max-content minmax(0, 1fr)', columnGap: '1rem', alignItems: 'center' }}>
			<div>
				<div class='buttons has-addons' style='border-style: solid; border-color: var(--primary-color); border-radius: 6px; padding: 1px; border-width: 1px; display: inline-flex; margin-bottom: 0;' >
					<button
						class={`button is-primary ${param.simulationMode ? 'is-outlined' : ''}`}
						style={`margin-bottom: 0px; ${param.simulationMode ? 'border-style: none;' : 'opacity: 1;'}`}
						disabled={!param.simulationMode}
						onClick={() => param.enableSimulationMode(false)}>
						Signing
					</button>
				</div>
			</div>
			<div>
				<RpcSelector rpcEntries={param.rpcEntries} rpcNetwork={param.rpcNetwork} changeRpc={param.changeActiveRpc} />
			</div>
		</header>
	</>
}

function FirstCard(param: FirstCardParams) {
	if (param.tabState?.signerName === 'NoSigner' && param.simulationMode === false) {
		return <>
			<section class='card' style='margin: 10px;'>
				<FirstCardHeader {...param} />
				<div class='card-content'>
					<DinoSays text={'No signer connnected. You can use Interceptor in simulation mode without a signer, but signing mode requires a browser wallet.'} />
				</div>
			</section>
		</>
	}

	return <>
		<section class='card' style='margin: 10px;'>
			<FirstCardHeader {...param} />
			<div class='card-content'>
				{param.useSignersAddressAsActiveAddress || !param.simulationMode ?
					<p style='color: var(--text-color); text-align: left; padding-bottom: 10px'>
						{param.tabState === undefined || param.tabState?.signerName === 'NoSigner' ? <></> : <><SignersLogoName signerName={param.tabState.signerName} /></>}
						{param.tabState?.signerConnected ? <span style='float: right; color: var(--primary-color);'>CONNECTED</span> : <span style='float: right; color: var(--negative-color);'>NOT CONNECTED</span>}
					</p>
					: <></>
				}

				<ActiveAddressComponent
					activeAddress={param.activeAddress}
					buttonText={'Change'}
					disableButton={!param.simulationMode}
					changeActiveAddress={param.changeActiveAddress}
					renameAddressCallBack={param.renameAddressCallBack}
				/>

				{(param.tabState?.signerAccounts.length === 0 && param.tabIconDetails.icon !== ICON_NOT_ACTIVE && param.tabIconDetails.icon !== ICON_NOT_ACTIVE_WITH_SHIELD) ?
					<div style='margin-top: 5px'>
						<button className='button is-primary' onClick={() => sendPopupMessageToBackgroundPage({ method: 'popup_requestAccountsFromSigner', data: true })} >
							<SignerLogoText
								signerName={param.tabState.signerName}
								text={`Connect to ${getPrettySignerName(param.tabState.signerName)}`}
							/>
						</button>
					</div>
					: <p style='color: var(--subtitle-text-color);' class='subtitle is-7'> {` You can change active address by changing it directly from ${getPrettySignerName(param.tabState?.signerName ?? 'NoSignerDetected')}`} </p>
				}
			</div>
		</section>

		<SignerExplanation
			activeAddress={param.activeAddress}
			simulationMode={param.simulationMode}
			tabState={param.tabState}
			useSignersAddressAsActiveAddress={param.useSignersAddressAsActiveAddress}
			tabIcon={param.tabIconDetails.icon}
		/>
	</>
}

export function Home(param: HomeParams) {
	const [activeSimulationAddress, setActiveSimulationAddress] = useState<AddressBookEntry | undefined>(undefined)
	const [activeSigningAddress, setActiveSigningAddress] = useState<AddressBookEntry | undefined>(undefined)
	const [useSignersAddressAsActiveAddress, setUseSignersAddressAsActiveAddress] = useState(false)
	const [simulationMode, setSimulationMode] = useState<boolean>(true)
	const [tabIconDetails, setTabConnection] = useState<TabIconDetails>(DEFAULT_TAB_CONNECTION)
	const [tabState, setTabState] = useState<TabState | undefined>(undefined)
	const [isLoaded, setLoaded] = useState<boolean>(false)
	const [activeAddresses, setActiveAddresses] = useState<AddressBookEntries>([])

	useEffect(() => {
		setUseSignersAddressAsActiveAddress(param.useSignersAddressAsActiveAddress)
		setActiveSimulationAddress(param.activeSimulationAddress !== undefined ? getActiveAddressEntry(param.activeSimulationAddress, param.activeAddresses) : undefined)
		setActiveSigningAddress(param.activeSigningAddress !== undefined ? getActiveAddressEntry(param.activeSigningAddress, param.activeAddresses) : undefined)
		setSimulationMode(param.simulationMode)
		setTabConnection(param.tabIconDetails)
		setTabState(param.tabState)
		setActiveAddresses(param.activeAddresses)
		setLoaded(true)
	}, [param.activeSigningAddress,
	param.activeSimulationAddress,
	param.tabState,
	param.activeAddresses,
	param.useSignersAddressAsActiveAddress,
	param.rpcNetwork.value,
	param.simulationMode,
	param.tabIconDetails,
	param.currentBlockNumber,
	param.simVisResults,
	param.rpcConnectionStatus,
	param.simulationUpdatingState,
	param.simulationResultState,
	])

	function enableSimulationMode(enabled: boolean) {
		sendPopupMessageToBackgroundPage({ method: 'popup_enableSimulationMode', data: enabled })
	}

	if (!isLoaded || param.rpcNetwork.value === undefined) return <> </>

	return <>
		{param.rpcNetwork.value.httpsRpc === undefined ?
			<ErrorComponent text={`${param.rpcNetwork.value.name} is not a supported network. PhisGuard is disabled while you are using ${param.rpcNetwork.value.name}.`} />
			: <></>}

		<FirstCard
			activeAddresses={activeAddresses}
			useSignersAddressAsActiveAddress={useSignersAddressAsActiveAddress}
			enableSimulationMode={enableSimulationMode}
			activeAddress={simulationMode ? activeSimulationAddress : activeSigningAddress}
			rpcNetwork={param.rpcNetwork}
			changeActiveRpc={param.setActiveRpcAndInformAboutIt}
			simulationMode={simulationMode}
			changeActiveAddress={param.changeActiveAddress}
			tabState={tabState}
			tabIconDetails={tabIconDetails}
			renameAddressCallBack={param.renameAddressCallBack}
			rpcEntries={param.rpcEntries}
		/>
	</>
}
