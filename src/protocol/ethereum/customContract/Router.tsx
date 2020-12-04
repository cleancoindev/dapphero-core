import React, { useState, useEffect, useContext } from 'react'

import * as contexts from 'contexts'
import * as consts from 'consts'
import { ethers, logger } from 'ethers'
// import { useWeb3Provider } from 'hooks'
import { useToasts } from 'react-toast-notifications'

import { EmitterContext } from 'providers/EmitterProvider/context'
import { EVENT_NAMES, EVENT_STATUS } from 'providers/EmitterProvider/constants'

import { Reducer as CustomContractReducer } from './Reducer'

type ContractMethod = {
  id: string;
}

type ListOfContractMethods = ContractMethod[];

type Contract = any;

type RouterProps = {
  listOfContractMethods: ListOfContractMethods;
  contract: Contract;
  timestamp: number;
  contractNetworkId: number;
}

export const Router: React.FunctionComponent<RouterProps> = ({ listOfContractMethods, contract, timestamp, contractNetworkId }) => {
  const ethereum = useContext(contexts.EthereumContext)
  const { signer, isEnabled: writeEnabled, chainId: writeChainId, provider } = ethereum
  const { contractAddress, contractAbi, networkId } = contract

  const [ writeContract, setWriteContract ] = useState(null)

  const { actions: { emitToEvent } } = useContext(EmitterContext)

  // Toast Notifications
  const { addToast } = useToasts()

  // Get the Network for our Project
  const contractNetwork = consts.global.ethNetworkName[networkId].toLowerCase()

  const stableReadProvider = new ethers.providers.JsonRpcProvider(consts.global.readProvider)

  // TODO: [DEV-340] Mainnet will always load backend provider because ethers calls it "homestead"
  const [ readContract, setReadContract ] = useState(null)
  useEffect(() => {
    const makeReadContract = (): void => {

      let readContractInstance = null
      // Make the contract instance from either the local provider or remote provider
      if (provider && contractNetwork === provider?._network?.name) {
        readContractInstance = new ethers.Contract(contractAddress, contractAbi, provider)
      } else {
        readContractInstance = new ethers.Contract(contractAddress, contractAbi, stableReadProvider)
      }
      readContractInstance.on('*', (data) => {
        emitToEvent(
          EVENT_NAMES.contract.contractEvent,
          { value: data, step: 'Contract has emitted a Contract Event', status: EVENT_STATUS.resolved, methodNameKey: null },
        )
      })
      setReadContract(readContractInstance)
    }
    makeReadContract()
  }, [ ])

  useEffect(() => {
    const makeWriteContract = (): void => {
      const writeContractInstance = new ethers.Contract(contractAddress, contractAbi, signer)
      setWriteContract(writeContractInstance)
    }

    // TODO: Check if we are on the same chainID as the Contract
    // if (writeEnabled && writeChainId === contractNetworkId) makeWriteContract()

    if (writeEnabled) makeWriteContract()
    // if (writeChainId !== contractNetworkId) {
    //   const msg = `Please change your network to ${consts.global.ethNetworkName[contractNetworkId]} to use the deployed contract.`
    //   addToast(msg, { appearance: 'info', autoDismiss: true, autoDismissTimeout: consts.global.REACT_TOAST_AUTODISMISS_INTERVAL })
    // }
    // Else pop up information that we are not on the right network
  }, [ writeChainId, signer, writeEnabled ])

  // Set this on the window object
  useEffect(() => {
    if (!window?.dappHero) return
    Object.assign(window.dappHero.contracts, { [contractAddress]: { readContract, writeContract } })
  }, [ readContract, writeContract ])

  // If not read contract or provider, return early
  if (!readContract) return null

  return (
    <>
      {listOfContractMethods.map((contractMethodElement: { id: React.ReactText }) => (
        <CustomContractReducer
          readContract={readContract}
          readChainId={networkId}
          writeContract={writeContract}
          writeChainId={writeChainId}
          readEnabled={Boolean(readContract)}
          writeEnabled={writeEnabled}
          info={contractMethodElement}
          key={contractMethodElement.id}
          timestamp={timestamp}
          contractAbi={contractAbi}
          contractNetworkId={contractNetworkId}
        />
      ))}
    </>
  )

}
