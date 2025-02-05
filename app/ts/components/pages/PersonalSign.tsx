import { PendingTransactionOrSignableMessage } from '../../types/accessRequest.js'
import { TransactionOrMessageIdentifier } from '../../types/interceptor-messages.js'
import { VisualizedPersonalSignRequest } from '../../types/personal-message-definitions.js'
import { RenameAddressCallBack } from '../../types/user-interface-types.js'
import { MOCK_PRIVATE_KEYS_ADDRESS } from '../../utils/constants.js'
import { assertNever } from '../../utils/typescript.js'
import { WebsiteOriginText } from '../subcomponents/address.js'
import { ErrorComponent } from '../subcomponents/Error.js'
import { XMarkIcon } from '../subcomponents/icons.js'

const HALF_HEADER_HEIGHT = 48 / 2

type SignatureHeaderParams = {
	visualizedPersonalSignRequest: VisualizedPersonalSignRequest
	removeTransactionOrSignedMessage?: ((transactionOrMessageIdentifier: TransactionOrMessageIdentifier) => void) | undefined
}

type SignatureCardParams = {
	visualizedPersonalSignRequest: VisualizedPersonalSignRequest
	renameAddressCallBack: RenameAddressCallBack
	removeTransactionOrSignedMessage: ((transactionOrMessageIdentifier: TransactionOrMessageIdentifier) => void) | undefined
	numberOfUnderTransactions: number
}

export function SignatureCard(params: SignatureCardParams) {
	console.log(params);
	return <div class='card' style={`top: ${params.numberOfUnderTransactions * -HALF_HEADER_HEIGHT}px`}>
		<SignatureHeader {...params} />
		<div class='card-content' style='padding-bottom: 5px;'>
			<span class='log-table' style='margin-top: 10px; grid-template-columns: auto auto;'>
				<div class='log-cell' style='justify-content: right;'></div>
			</span>
		</div>
	</div>
}


export function identifySignature(data: VisualizedPersonalSignRequest) {
	switch (data.type) {
		case 'EIP712': {
			const name = data.message.domain.name?.type === 'string' ? `${data.message.domain.name.value} - ${data.message.primaryType}` : 'Arbitrary EIP712 message'
			return {
				title: `${name} signing request`,
				rejectAction: `Reject ${name}`,
				simulationAction: `Simulate ${name}`,
				signingAction: `Sign ${name}`,
			}
		}
		case 'NotParsed': return {
			title: 'Arbitrary Ethereum message',
			rejectAction: 'Reject arbitrary message',
			simulationAction: 'Simulate arbitrary message',
			signingAction: 'Sign arbitrary message',
		}
		case 'Permit': {
			const symbol = data.verifyingContract
			return {
				title: `${symbol} Permit`,
				signingAction: `Sign ${symbol} Permit`,
				simulationAction: `Simulate ${symbol} Permit`,
				rejectAction: `Reject ${symbol} Permit`,
				to: data.spender
			}
		}
		case 'Permit2': {
			const symbol = 'symbol' in data.token ? data.token.symbol : '???'
			return {
				title: `${symbol} Permit`,
				signingAction: `Sign ${symbol} Permit`,
				simulationAction: `Simulate ${symbol} Permit`,
				rejectAction: `Reject ${symbol} Permit`,
				to: data.spender
			}
		}
		default: assertNever(data)
	}
}

export function SignatureHeader(params: SignatureHeaderParams) {
	const removeSignedMessage = params.removeTransactionOrSignedMessage
	return <header class='card-header'>
		<div class='card-header-icon unset-cursor'>
			<span class='icon'>
				<img src={'../img/head-signing.png'} />
			</span>
		</div>
		<p class='card-header-title' style='white-space: nowrap;'>
			{identifySignature(params.visualizedPersonalSignRequest).title}
		</p>
		<p class='card-header-icon unsetcursor' style={`margin-left: auto; margin-right: 0; overflow: hidden; ${params.removeTransactionOrSignedMessage !== undefined ? 'padding: 0' : ''}`}>
			<WebsiteOriginText {...params.visualizedPersonalSignRequest.website} />
		</p>
		{removeSignedMessage !== undefined
			? <button class='card-header-icon' aria-label='remove' onClick={() => removeSignedMessage({ type: 'SignedMessage', messageIdentifier: params.visualizedPersonalSignRequest.messageIdentifier })}>
				<XMarkIcon />
			</button>
			: <></>
		}
	</header>
}

export function isPossibleToSignMessage(visualizedPersonalSignRequest: VisualizedPersonalSignRequest, activeAddress: bigint) {
	return !((activeAddress !== MOCK_PRIVATE_KEYS_ADDRESS || visualizedPersonalSignRequest.method !== 'personal_sign'))
}

export function InvalidMessage({ pendingTransactionOrSignableMessage }: { pendingTransactionOrSignableMessage: PendingTransactionOrSignableMessage }) {
	if (pendingTransactionOrSignableMessage.type !== 'SignableMessage') return <></>
	if (pendingTransactionOrSignableMessage.transactionOrMessageCreationStatus !== 'Simulated') return <></>
	if (pendingTransactionOrSignableMessage.visualizedPersonalSignRequest.isValidMessage !== false) return <></>
	return <ErrorComponent warning={true} text={'The requested message format is invalid and cannot be signed.'} />
}
