import { ReadonlySignal, Signal, useComputed } from '@preact/signals'
import { ethers } from 'ethers'
import { ComponentChildren, createRef } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { sendPopupMessageToBackgroundPage } from '../../background/backgroundUtils.js'
import { AddressBookEntry, DeclarativeNetRequestBlockMode, IncompleteAddressBookEntry } from '../../types/addressBookTypes.js'
import { MessageToPopup } from '../../types/interceptor-messages.js'
import { ChainEntry, RpcEntries } from '../../types/rpc.js'
import { AddAddressParam } from '../../types/user-interface-types.js'
import { ModifyAddressWindowState } from '../../types/visualizer-types.js'
import { checksummedAddress, stringToAddress } from '../../utils/bigint.js'
import { modifyObject } from '../../utils/typescript.js'
import { AddressIcon } from '../subcomponents/address.js'
import { ChainSelector } from '../subcomponents/ChainSelector.js'
import { ErrorCheckBox, Notice } from '../subcomponents/Error.js'
import { XMarkIcon } from '../subcomponents/icons.js'

const readableAddressType = {
	contact: 'Contact',
	activeAddress: 'Active Address',
}

type IncompleteAddressIconParams = {
	addressInput: string | undefined,
	logoUri: string | undefined,
}

function IncompleteAddressIcon({ addressInput, logoUri }: IncompleteAddressIconParams) {
	return <AddressIcon
		address={stringToAddress(addressInput)}
		logoUri={logoUri}
		isBig={true}
		backgroundColor={'var(--text-color)'}
	/>
}

type NameInputParams = {
	nameInput: string | undefined
	setNameInput: (input: string) => void
	disabled: boolean,
}

function NameInput({ nameInput, setNameInput, disabled }: NameInputParams) {
	const ref = createRef<HTMLInputElement>()
	useEffect(() => { ref.current?.focus() }, [])
	return <input
		className='input title is-5 is-spaced'
		type='text'
		value={nameInput}
		placeholder={'What should we call this address?'}
		onInput={e => setNameInput((e.target as HTMLInputElement).value)}
		maxLength={42}
		ref={ref}
		style={'width: 100%'}
		disabled={disabled}
	/>
}

type AddressInputParams = {
	disabled: boolean
	addressInput: string | undefined
	setAddress: (input: string) => void
}

function AddressInput({ disabled, addressInput, setAddress }: AddressInputParams) {
	return <input
		disabled={disabled}
		className='input subtitle is-7 is-spaced'
		type='text'
		value={addressInput}
		placeholder={'0x0...'}
		onInput={e => setAddress((e.target as HTMLInputElement).value)}
		style={`width: 100%;${addressInput === undefined || ethers.isAddress(addressInput.trim()) ? '' : 'color: var(--negative-color);'}`}
	/>
}

type RenderinCompleteAddressBookParams = {
	incompleteAddressBookEntry: ReadonlySignal<IncompleteAddressBookEntry | undefined>
	rpcEntries: Signal<RpcEntries>
	canFetchFromEtherScan: boolean
	setName: (name: string) => void
	setAddress: (address: string) => void
	setSymbol: (symbol: string) => void
	setUseAsActiveAddress: (useAsActiveAddress: boolean) => void
	setDeclarativeNetRequestBlockMode: (declarativeNetRequestBlockMode: DeclarativeNetRequestBlockMode) => void
	setAbi: (abi: string) => void
	setChain: (chainEntry: ChainEntry) => void
}

const CellElement = (param: { element: ComponentChildren }) => {
	return <div class='log-cell' style='justify-content: right;'>
		{param.element}
	</div>
}

function RenderIncompleteAddressBookEntry({ rpcEntries, incompleteAddressBookEntry, setName, setAddress, setUseAsActiveAddress, setDeclarativeNetRequestBlockMode, setChain }: RenderinCompleteAddressBookParams) {
	const Text = (param: { text: ComponentChildren }) => {
		return <p class='paragraph' style='color: var(--subtitle-text-color); text-overflow: ellipsis; overflow: hidden; width: 100%'>
			{param.text}
		</p>
	}
	if (incompleteAddressBookEntry.value === undefined) return <></>
	const disableDueToSource = incompleteAddressBookEntry.value.entrySource === 'DarkFloristMetadata' || incompleteAddressBookEntry.value.entrySource === 'Interceptor'
	const logoUri = incompleteAddressBookEntry.value.addingAddress === false && 'logoUri' in incompleteAddressBookEntry ? incompleteAddressBookEntry.value.logoUri : undefined
	const selectedChainId = useComputed(() => incompleteAddressBookEntry.value?.chainId || 1n)
	return <div class='media'>
		<div class='media-left'>
			<figure class='image'>
				<IncompleteAddressIcon addressInput={incompleteAddressBookEntry.value.address} logoUri={logoUri} />
			</figure>
		</div>
		<div class='media-content' style='overflow-y: unset; overflow-x: unset;'>
			<div class='container' style='margin-bottom: 10px;'>
				<span class='log-table' style='column-gap: 5px; row-gap: 5px; grid-template-columns: max-content auto;'>
					<CellElement element={<Text text={'Chain: '} />} />
					<CellElement element={<ChainSelector rpcEntries={rpcEntries} chainId={selectedChainId} changeChain={setChain} />} />
					<CellElement element={<Text text={'Name: '} />} />
					<CellElement element={<NameInput nameInput={incompleteAddressBookEntry.value.name} setNameInput={setName} disabled={disableDueToSource} />} />
					<CellElement element={<Text text={'Address: '} />} />
					<CellElement element={<AddressInput disabled={incompleteAddressBookEntry.value.addingAddress === false || disableDueToSource} addressInput={incompleteAddressBookEntry.value.address} setAddress={setAddress} />} />
					<CellElement element={<Text text={'Abi: '} />} />
				</span>
			</div>
			<label class='form-control'>
				<input type='checkbox' checked={incompleteAddressBookEntry.value.useAsActiveAddress} onInput={e => { if (e.target instanceof HTMLInputElement && e.target !== null) { setUseAsActiveAddress(e.target.checked) } }} />
				<p class='paragraph checkbox-text'>Use as active address</p>
			</label>
		</div>
	</div>
}

export function AddNewAddress(param: AddAddressParam) {
	const [activeAddress, setActiveAddress] = useState<bigint | undefined>(undefined)
	const [onChainInformationVerifiedByUser, setOnChainInformationVerifiedByUser] = useState<boolean>(false)
	const [canFetchFromEtherScan, setCanFetchFromEtherScan] = useState<boolean>(false)

	useEffect(() => {
		const popupMessageListener = (msg: unknown) => {
			const maybeParsed = MessageToPopup.safeParse(msg)
			if (!maybeParsed.success) return // not a message we are interested in
			const parsed = maybeParsed.value
			if (parsed.method === 'popup_addOrModifyAddressWindowStateInformation') {
				if (param.modifyAddressWindowState.value === undefined) return
				if (parsed.data.windowStateId !== param.modifyAddressWindowState.value.windowStateId) return
				param.modifyAddressWindowState.value = modifyObject(param.modifyAddressWindowState.value, { errorState: parsed.data.errorState })
			}
		}
		browser.runtime.onMessage.addListener(popupMessageListener)
		return () => browser.runtime.onMessage.removeListener(popupMessageListener)
	}, [])

	useEffect(() => {
		setActiveAddress(param.activeAddress)
		if (param.modifyAddressWindowState.value !== undefined) setCanFetchFromEtherScan(stringToAddress(param.modifyAddressWindowState.value.incompleteAddressBookEntry.address) !== undefined)
	}, [param.modifyAddressWindowState.value?.windowStateId, param.activeAddress])

	function getCompleteAddressBookEntry(): AddressBookEntry | undefined {
		const incompleteAddressBookEntry = param.modifyAddressWindowState.peek()?.incompleteAddressBookEntry
		if (incompleteAddressBookEntry === undefined) return undefined
		if (incompleteAddressBookEntry.name !== undefined && incompleteAddressBookEntry.name.length > 42) return undefined
		const inputedAddressBigInt = stringToAddress(incompleteAddressBookEntry.address)
		if (inputedAddressBigInt === undefined) return undefined
		const name = incompleteAddressBookEntry.name ? incompleteAddressBookEntry.name : checksummedAddress(inputedAddressBigInt)
		const abi = incompleteAddressBookEntry.abi || undefined
		const base = {
			name,
			address: inputedAddressBigInt,
			declarativeNetRequestBlockMode: incompleteAddressBookEntry.declarativeNetRequestBlockMode,
			useAsActiveAddress: incompleteAddressBookEntry.useAsActiveAddress,
			chainId: incompleteAddressBookEntry.chainId,
			entrySource: 'User' as const,
		}

		switch (incompleteAddressBookEntry.type) {
			case 'contact': return {
				...base,
				type: incompleteAddressBookEntry.type,
				logoUri: incompleteAddressBookEntry.logoUri,
				abi,
			}
			default: return undefined
		}
	}

	async function modifyOrAddEntry() {
		const entryToAdd = getCompleteAddressBookEntry()
		param.close()
		if (entryToAdd === undefined) return
		await sendPopupMessageToBackgroundPage({ method: 'popup_addOrModifyAddressBookEntry', data: entryToAdd })
	}

	async function createAndSwitch() {
		if (param.modifyAddressWindowState.value === undefined) return
		const incompleteAddressBookEntry = param.modifyAddressWindowState.value.incompleteAddressBookEntry
		const inputedAddressBigInt = stringToAddress(incompleteAddressBookEntry.address)
		if (inputedAddressBigInt === undefined) return
		await modifyOrAddEntry()
		if (param.setActiveAddressAndInformAboutIt !== undefined) await param.setActiveAddressAndInformAboutIt(inputedAddressBigInt)
	}

	const areInputsValid = () => getCompleteAddressBookEntry() !== undefined

	async function modifyState(newState: ModifyAddressWindowState) {
		if (newState === undefined) return
		param.modifyAddressWindowState.value = newState
		try {
			await sendPopupMessageToBackgroundPage({ method: 'popup_changeAddOrModifyAddressWindowState', data: { windowStateId: newState.windowStateId, newState } })
		} catch (e) {
			console.error(e)
		}
	}

	const setAddress = async (address: string) => {
		const previous = param.modifyAddressWindowState.peek()
		if (previous === undefined) return
		modifyState(modifyObject(previous, { incompleteAddressBookEntry: modifyObject(previous.incompleteAddressBookEntry, { address }) }))
		setCanFetchFromEtherScan(true)
	}
	const setName = async (name: string) => {
		const previous = param.modifyAddressWindowState.peek()
		if (previous === undefined) return
		modifyState(modifyObject(previous, { incompleteAddressBookEntry: modifyObject(previous.incompleteAddressBookEntry, { name }) }))
	}
	const setChain = async (chainEntry: ChainEntry) => {
		const previous = param.modifyAddressWindowState.peek()
		if (previous === undefined) return
		modifyState(modifyObject(previous, { incompleteAddressBookEntry: modifyObject(previous.incompleteAddressBookEntry, { chainId: chainEntry.chainId }) }))
	}
	const setAbi = async (abi: string | undefined) => {
		const previous = param.modifyAddressWindowState.peek()
		if (previous === undefined) return
		modifyState(modifyObject(previous, { incompleteAddressBookEntry: modifyObject(previous.incompleteAddressBookEntry, { abi }) }))
		setCanFetchFromEtherScan(true)
	}
	const setSymbol = async (symbol: string) => {
		const previous = param.modifyAddressWindowState.peek()
		if (previous === undefined) return
		modifyState(modifyObject(previous, { incompleteAddressBookEntry: modifyObject(previous.incompleteAddressBookEntry, { symbol }) }))
	}
	const setUseAsActiveAddress = async (useAsActiveAddress: boolean) => {
		const previous = param.modifyAddressWindowState.peek()
		if (previous === undefined) return
		modifyState(modifyObject(previous, { incompleteAddressBookEntry: modifyObject(previous.incompleteAddressBookEntry, { useAsActiveAddress }) }))
	}
	const setDeclarativeNetRequestBlockMode = async (declarativeNetRequestBlockMode: DeclarativeNetRequestBlockMode) => {
		const previous = param.modifyAddressWindowState.peek()
		if (previous === undefined) return
		modifyState(modifyObject(previous, { incompleteAddressBookEntry: modifyObject(previous.incompleteAddressBookEntry, { declarativeNetRequestBlockMode }) }))
	}
	function showOnChainVerificationErrorBox() {
		if (param.modifyAddressWindowState.value === undefined) return false
		const incompleteAddressBookEntry = param.modifyAddressWindowState.value.incompleteAddressBookEntry
		return incompleteAddressBookEntry.entrySource === 'OnChain'
	}

	function isSubmitButtonDisabled() {
		if (param.modifyAddressWindowState.value === undefined) return true
		return !areInputsValid()
			|| (param.modifyAddressWindowState.value.errorState?.blockEditing)
			|| (showOnChainVerificationErrorBox() && !onChainInformationVerifiedByUser)
	}

	function getCardTitle() {
		if (param.modifyAddressWindowState.value === undefined) return '...'
		const incompleteAddressBookEntry = param.modifyAddressWindowState.value.incompleteAddressBookEntry
		if (incompleteAddressBookEntry.addingAddress) {
			return `Add New ${readableAddressType[incompleteAddressBookEntry.type]}`
		}
		const alleged = showOnChainVerificationErrorBox() ? 'alleged ' : ''
		const name = incompleteAddressBookEntry.name !== undefined ? `${alleged}${incompleteAddressBookEntry.name}` : readableAddressType[incompleteAddressBookEntry.type]
		return `Modify ${name}`
	}
	const incompleteAddressBookEntry = useComputed(() => param.modifyAddressWindowState.value?.incompleteAddressBookEntry)
	if (incompleteAddressBookEntry.value === undefined) return <></>
	return (<>
		<div class='modal-background'> </div>
		<div class='modal-card'>
			<header class='modal-card-head card-header interceptor-modal-head window-header'>
				<div class='card-header-icon unset-cursor'>
					<span class='icon'>
						<img src='../img/address-book.svg' />
					</span>
				</div>
				<div class='card-header-title'>
					<p className='paragraph'> {getCardTitle()} </p>
				</div>
				<button class='card-header-icon' aria-label='close' onClick={param.close}>
					<XMarkIcon />
				</button>
			</header>
			<section class='modal-card-body' style='overflow: visible;'>
				<div class='card' style='margin: 10px;'>
					<div class='card-content'>
						<RenderIncompleteAddressBookEntry
							incompleteAddressBookEntry={incompleteAddressBookEntry}
							setAddress={setAddress}
							setName={setName}
							setSymbol={setSymbol}
							setAbi={setAbi}
							setChain={setChain}
							rpcEntries={param.rpcEntries}
							setUseAsActiveAddress={setUseAsActiveAddress}
							setDeclarativeNetRequestBlockMode={setDeclarativeNetRequestBlockMode}
							canFetchFromEtherScan={canFetchFromEtherScan}
						/>
					</div>
				</div>
				<div style='padding-left: 10px; padding-right: 10px; margin-bottom: 10px; min-height: 80px'>
					{param.modifyAddressWindowState.value?.errorState === undefined ? <></> : <Notice text={param.modifyAddressWindowState.value.errorState.message} />}
					{!showOnChainVerificationErrorBox() ? <></> :
						<ErrorCheckBox
							text={`The name and symbol for this token was provided by the token itself and we have not validated its legitimacy. A token may claim to have a name/symbol that is the same as another popular token (e.g., USDC or DAI) in an attempt to trick you. If you recognize this token's name, please verify elsewhere that this is the correct address for it.`}
							checked={onChainInformationVerifiedByUser}
							onInput={setOnChainInformationVerifiedByUser}
						/>
					}
				</div>
			</section>
			<footer class='modal-card-foot window-footer' style='border-bottom-left-radius: unset; border-bottom-right-radius: unset; border-top: unset; padding: 10px;'>
				{param.setActiveAddressAndInformAboutIt === undefined || param.modifyAddressWindowState.value?.incompleteAddressBookEntry === undefined || activeAddress === stringToAddress(param.modifyAddressWindowState.value.incompleteAddressBookEntry.address) ? <></> : <button class='button is-success is-primary' onClick={createAndSwitch} disabled={!areInputsValid()}> {param.modifyAddressWindowState.value.incompleteAddressBookEntry.addingAddress ? 'Create and switch' : 'Modify and switch'} </button>}
				<button class='button is-success is-primary' onClick={modifyOrAddEntry} disabled={isSubmitButtonDisabled()}> {param.modifyAddressWindowState.value?.incompleteAddressBookEntry.addingAddress ? 'Create' : 'Modify'} </button>
				<button class='button is-primary' style='background-color: var(--negative-color)' onClick={param.close}>Cancel</button>
			</footer>
		</div>
	</>)
}
