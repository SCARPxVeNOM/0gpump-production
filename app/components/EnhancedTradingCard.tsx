'use client'

import React, { useState, useEffect } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { ethers, BrowserProvider } from 'ethers'
import { newBondingCurveTradingService } from '../../lib/newBondingCurveTradingService'
import { Info, X, Copy, ExternalLink } from 'lucide-react'
import CoinImage from './CoinImage'

interface EnhancedTradingCardProps {
  tokenAddress: string
  tokenName: string
  tokenSymbol: string
  description: string
  imageUrl?: string
  metadataUrl?: string
  creator: string
  createdAt: string
  supply?: string
  curveAddress?: string
}

export default function EnhancedTradingCard({
  tokenAddress,
  tokenName,
  tokenSymbol,
  description,
  imageUrl,
  metadataUrl,
  creator,
  createdAt,
  supply,
  curveAddress
}: EnhancedTradingCardProps) {
  const { address: userAddress, isConnected } = useAccount()
  const publicClient = usePublicClient()
  
  // Use the curve address from props
  const [curveAddressState, setCurveAddressState] = useState<string | null>(curveAddress || null)
  
  // Trading state
  const [tradeAmount, setTradeAmount] = useState('')
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const [slippageTolerance, setSlippageTolerance] = useState(0.05) // 5%
  
  // Curve info state
  const [curveInfo, setCurveInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Quotes state
  const [buyQuote, setBuyQuote] = useState<any>(null)
  const [sellQuote, setSellQuote] = useState<any>(null)
  const [isTrading, setIsTrading] = useState(false)
  
  // Provider state
  const [provider, setProvider] = useState<any>(null)
  
  // Info modal state - ONLY controlled by button click
  const [showInfoModal, setShowInfoModal] = useState(false)
  
  // Track if button was clicked - this is the ONLY way to open modal
  const [buttonClicked, setButtonClicked] = useState(false)

  // User balances
  const [userTokenBalance, setUserTokenBalance] = useState('0')
  const [userNativeBalance, setUserNativeBalance] = useState('0')

  // Debug modal state changes
  useEffect(() => {
    if (showInfoModal) {
      console.log('🚨 INFO MODAL OPENED for:', tokenName)
    } else {
      console.log('✅ INFO MODAL CLOSED for:', tokenName)
    }
  }, [showInfoModal, tokenName])

  // Function to open modal (explicit) - ONLY way to open modal
  const openInfoModal = () => {
    console.log('🎯 INFO BUTTON CLICKED - Opening info modal for token:', tokenName)
    setButtonClicked(true)
    setShowInfoModal(true)
  }

  // Function to close modal
  const closeInfoModal = () => {
    console.log('Closing info modal')
    setShowInfoModal(false)
    setButtonClicked(false)
  }

  // Close modal only with Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeInfoModal()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])
  
  // Initialize services
  useEffect(() => {
    if (isConnected) {
      (async () => {
      try {
        const eth = (typeof window !== 'undefined') ? (window as any).ethereum : undefined
        if (!eth) return
          const ethersProvider = new BrowserProvider(eth)
        setProvider(ethersProvider)
          await newBondingCurveTradingService.initialize(ethersProvider)
        
        // Use curve address from props if available
        if (curveAddress && curveAddress !== '' && curveAddress !== 'undefined') {
          setCurveAddressState(curveAddress)
          loadCurveInfo(curveAddress)
        } else if (tokenAddress && tokenAddress !== '' && tokenAddress !== 'undefined') {
          // Fallback: try to use token address (this won't work for trading)
          console.warn('⚠️ No curve address provided - trading will not work')
          setCurveAddressState(null)
        }
      } catch (error) {
        console.warn('Failed to initialize services:', error)
      }
      })()
    }
  }, [isConnected, tokenAddress, curveAddress])
  
  const loadCurveInfo = async (curveAddr: string) => {
    if (!provider) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const info = await newBondingCurveTradingService.getCurveInfo(curveAddr)
      if (info) {
        setCurveInfo(info)
      } else {
        setError('Could not load curve information')
        setCurveInfo(null)
      }
    } catch (error: any) {
      console.warn('Could not load curve info:', error)
      setError(error.message || 'Failed to load curve info')
      setCurveInfo(null)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Get user balances
  useEffect(() => {
    if (userAddress && curveAddressState && provider) {
      updateBalances()
    }
  }, [userAddress, curveAddressState, provider])
  
  const updateBalances = async () => {
    if (!userAddress || !curveAddressState || !provider) return
    
    try {
      // Get curve info to get the token address
      const curveInfo = await newBondingCurveTradingService.getCurveInfo(curveAddressState)
      
      if (!curveInfo) {
        console.warn('Could not get curve info, skipping balance update')
        return
      }
      
      const [tokenBalance, nativeBalance] = await Promise.all([
        newBondingCurveTradingService.getTokenBalance(curveInfo.tokenAddress, userAddress),
        newBondingCurveTradingService.getNativeBalance(userAddress)
      ])
      
      setUserTokenBalance(tokenBalance)
      setUserNativeBalance(nativeBalance)
    } catch (error) {
      console.error('Error updating balances:', error)
    }
  }

  // Handle trade amount change
  const handleTradeAmountChange = async (amount: string) => {
    setTradeAmount(amount)
    
    if (!amount || parseFloat(amount) <= 0 || !curveAddressState) {
      return
    }
      
    try {
      if (tradeType === 'buy') {
        const quote = await newBondingCurveTradingService.getBuyQuote(curveAddressState, amount)
          setBuyQuote(quote)
      } else {
        const quote = await newBondingCurveTradingService.getSellQuote(curveAddressState, amount)
          setSellQuote(quote)
      }
    } catch (error) {
      console.error('Error getting quote:', error)
    }
  }

  // Handle trade execution
  const handleTrade = async () => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0 || !curveAddressState) {
      return
    }
    
    setIsTrading(true)
    
    try {
      let result
      
      if (tradeType === 'buy') {
        if (!buyQuote) return
        
        // Calculate min tokens out with slippage protection
        const minTokensOut = (parseFloat(buyQuote.outputAmount) * (1 - slippageTolerance)).toString()
        
        result = await newBondingCurveTradingService.buyTokens(curveAddressState, tradeAmount, minTokensOut)
      } else {
        if (!sellQuote) return
        
        // Calculate min OG out with slippage protection
        const minOgOut = (parseFloat(sellQuote.outputAmount) * (1 - slippageTolerance)).toString()
        
        result = await newBondingCurveTradingService.sellTokens(curveAddressState, tradeAmount, minOgOut)
      }
      
      if (result.success) {
        // Clear trade amount and refresh data
        setTradeAmount('')
        await updateBalances()
        await loadCurveInfo(curveAddressState)
        
        // Update user's trading stats in profile
        try {
          if (userAddress) {
            const tradeVolume = parseFloat(tradeAmount)
            const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
            await fetch(`${backendBase}/profile/${userAddress}/stats`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                totalTrades: 1, // Increment by 1
                totalVolume: tradeVolume, // Add this trade's volume
                tokensHeld: tradeType === 'buy' ? 1 : 0, // Increment if buying
                favoriteTokens: [tokenSymbol] // Add this token to favorites
              })
            })
          }
        } catch (profileError) {
          console.warn('Failed to update trading stats:', profileError)
          // Don't fail the trade for profile errors
        }
        
        // Show success message
        alert(`Trade successful! TX: ${result.txHash}`)
      } else {
        alert(`Trade failed: ${result.error}`)
      }
    } catch (error: any) {
      console.error('Trade execution failed:', error)
      alert(`Trade failed: ${error.message}`)
    } finally {
      setIsTrading(false)
    }
  }

  // Utility functions
  const formatBalance = (balance: string) => {
    const num = parseFloat(balance)
    if (isNaN(num)) return '0.00'
    return num.toFixed(6)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'Unknown date'
    }
  }

  const shortenAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-gray-200 rounded-lg"></div>
          </div>
    )
  }

  return (
    <>
      {/* Main Card */}
      <div className="space-y-4 bg-sky-100 rounded-2xl p-4 border-4 border-black">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <CoinImage 
            coin={{
              name: tokenName,
              symbol: tokenSymbol,
              imageUrl: imageUrl,
              // Extract imageHash from URL if it's in the format /download/{hash}
              imageHash: imageUrl?.includes('/download/') 
                ? imageUrl.split('/download/')[1].split('?')[0] 
                : imageUrl?.startsWith('http') 
                  ? undefined 
                  : imageUrl,
              imageRootHash: imageUrl?.includes('/download/') 
                ? imageUrl.split('/download/')[1].split('?')[0] 
                : imageUrl?.startsWith('http') 
                  ? undefined 
                  : imageUrl
            } as any}
            size="lg"
            className="border-4 border-black shadow-[4px_4px_0_#000]"
          />
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-gray-900">
                {tokenName} ({tokenSymbol})
              </h2>
              {curveInfo && (
                <span className="px-3 py-1 bg-yellow-200 border-2 border-black text-black text-sm font-extrabold rounded-full shadow-[2px_2px_0_#000]">
                  {parseFloat(curveInfo.currentPrice).toFixed(6)} OG
                </span>
              )}
              <button
                onClick={openInfoModal}
                className="p-2 text-gray-800 hover:text-black hover:bg-yellow-200 rounded-full border-2 border-black shadow-[2px_2px_0_#000]"
                title="View token information"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mt-1">
              {tokenName} ({tokenSymbol}) - A memecoin created on OG Chain. Created by {shortenAddress(creator)} on {formatDate(createdAt)}.
            </p>
          </div>
        </div>
        
        {/* Current Price Display */}
        {curveInfo && (
          <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-blue-800">Current Price:</span>
                <div className="text-2xl font-bold text-blue-900 mt-1">
                  {parseFloat(curveInfo.currentPrice).toFixed(6)} OG per {tokenSymbol}
          </div>
            </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Market Cap</div>
                <div className="text-lg font-semibold text-gray-900">
                  {curveInfo.ogReserve} OG
        </div>
            </div>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">OG Reserve:</span>
                  <div className="font-mono text-gray-900">{curveInfo.ogReserve}</div>
                </div>
                <div>
                  <span className="text-gray-600">Token Reserve:</span>
                  <div className="font-mono text-gray-900">{curveInfo.tokenReserve}</div>
                </div>
                <div>
                  <span className="text-gray-600">Trading Fee:</span>
                  <div className="font-mono text-gray-900">{curveInfo.feeBps / 100}%</div>
          </div>
            </div>
            </div>
          </div>
        )}

        {/* Trading Interface */}
        {isConnected && curveAddressState && (
          <div className="rounded-2xl p-4 mb-6 bg-white border-4 border-black shadow-[6px_6px_0_#000]">
            <h3 className="text-lg font-extrabold mb-4 text-slate-900">Trade {tokenSymbol}</h3>
            
            {/* Trade Type Toggle */}
            <div className="flex bg-white rounded-lg p-1 mb-4 border-4 border-black shadow-[4px_4px_0_#000] hover:shadow-[3px_3px_0_#000]">
              <button
                onClick={() => setTradeType('buy')}
                className={`flex-1 py-2 px-4 rounded-md font-extrabold transition-transform border-4 border-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#000] ${
                  tradeType === 'buy'
                    ? 'bg-green-400 text-black shadow-[3px_3px_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#000]'
                    : 'bg-white text-slate-800 hover:bg-slate-100 shadow-[3px_3px_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#000]'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeType('sell')}
                className={`flex-1 py-2 px-4 rounded-md font-extrabold transition-transform border-4 border-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#000] ${
                  tradeType === 'sell'
                    ? 'bg-red-400 text-black shadow-[3px_3px_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#000]'
                    : 'bg-white text-slate-800 hover:bg-slate-100 shadow-[3px_3px_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#000]'
                }`}
              >
                Sell
              </button>
            </div>

            {/* Trade Amount Input */}
            <div className="mb-4">
              <label className="block text-sm font-extrabold text-slate-900 mb-2">
                {tradeType === 'buy' ? 'Amount of OG to spend' : 'Amount of tokens to sell'}
              </label>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => handleTradeAmountChange(e.target.value)}
                  placeholder={tradeType === 'buy' ? '0.0' : '0.0'}
                  className="w-full px-3 py-2 rounded-md border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#000]"
                  step="0.1"
                  min="0"
                />
            </div>

            {/* Slippage Tolerance */}
            <div className="mb-4">
              <label className="block text-sm font-extrabold text-slate-900 mb-2">
                Slippage Tolerance: {(slippageTolerance * 100).toFixed(1)}%
              </label>
              <input
                type="range"
                min="0.01"
                max="0.20"
                step="0.01"
                value={slippageTolerance}
                onChange={(e) => setSlippageTolerance(parseFloat(e.target.value))}
                className="w-full h-2 bg-white rounded-lg appearance-none cursor-pointer border-4 border-black shadow-[2px_2px_0_#000]"
              />
            </div>

            {/* Execute Trade Button */}
            <button
              onClick={handleTrade}
              disabled={isTrading || !tradeAmount || parseFloat(tradeAmount) <= 0}
              className={`w-full py-2 px-4 rounded-md font-extrabold transition-transform border-4 border-black shadow-[6px_6px_0_#000] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[3px_3px_0_#000] ${
                isTrading || !tradeAmount || parseFloat(tradeAmount) <= 0
                  ? 'bg-gray-300 text-slate-600 cursor-not-allowed'
                  : tradeType === 'buy'
                  ? 'bg-green-400 text-black'
                  : 'bg-red-400 text-black'
              }`}
            >
              {isTrading ? 'Processing...' : `${tradeType === 'buy' ? 'Buy' : 'Sell'} ${tokenSymbol}`}
            </button>
          </div>
        )}

        {/* No Curve Message */}
        {!curveAddressState && isConnected && (
          <div className="text-center py-8 text-gray-500">
            {!tokenAddress || tokenAddress === '' || tokenAddress === 'undefined' ? (
              <div>
                <div className="text-yellow-600 mb-2">⚠️ Legacy Token</div>
                <div className="text-sm">
                  This token was created before bonding curves were implemented. Only new tokens created with the 'Create Token' button support trading.
                </div>
              </div>
            ) : (
              <div>This token doesn't have a bonding curve yet.</div>
                  )}
                </div>
              )}

        {/* Balances */}
        {isConnected && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 font-medium">Your {tokenSymbol}</div>
              <div className="text-lg font-bold text-gray-900">
                {formatBalance(userTokenBalance)}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 font-medium">Your OG</div>
              <div className="text-lg font-bold text-gray-900">
                {formatBalance(userNativeBalance)} mOG
              </div>
        </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        )}
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Token Information</h2>
              <button
                onClick={closeInfoModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Token Basic Info */}
              <div className="flex items-center space-x-3">
                <CoinImage 
                  coin={{
                    name: tokenName,
                    symbol: tokenSymbol,
                    imageUrl: imageUrl,
                    imageHash: imageUrl?.includes('/download/') 
                      ? imageUrl.split('/download/')[1].split('?')[0] 
                      : imageUrl?.startsWith('http') 
                        ? undefined 
                        : imageUrl,
                    imageRootHash: imageUrl?.includes('/download/') 
                      ? imageUrl.split('/download/')[1].split('?')[0] 
                      : imageUrl?.startsWith('http') 
                        ? undefined 
                        : imageUrl
                  } as any}
                  size="md"
                />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{tokenName}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      {tokenSymbol}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      curveAddressState 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {curveAddressState ? '✅ Tradable' : '⚠️ Legacy'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Token Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <p className="text-gray-900">{description || 'No description available'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Creator</label>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-900 font-mono text-sm">
                      {shortenAddress(creator)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(creator)}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Copy address"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                  <p className="text-gray-900">{formatDate(createdAt)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supply</label>
                  <p className="text-gray-900">{supply ? `${supply} ${tokenSymbol}` : 'Unknown'}</p>
                </div>
              </div>

              {/* Contract Addresses */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Token Contract:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-mono text-gray-900">
                      {shortenAddress(tokenAddress)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(tokenAddress)}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Copy address"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {curveAddressState && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">Bonding Curve:</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-mono text-gray-900">
                        {shortenAddress(curveAddressState)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(curveAddressState)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Copy address"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Trading Status */}
              {curveAddressState && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Trading Enabled</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    This token supports immediate trading through its bonding curve.
                  </p>
          </div>
        )}

              {/* Curve Info */}
              {curveInfo && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Bonding Curve Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">OG Reserve:</span>
                      <span className="ml-2 font-mono">{curveInfo.ogReserve}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Token Reserve:</span>
                      <span className="ml-2 font-mono">{curveInfo.tokenReserve}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Current Price:</span>
                      <span className="ml-2 font-mono">{curveInfo.currentPrice} OG</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Fee:</span>
                      <span className="ml-2 font-mono">{curveInfo.feeBps / 100}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
