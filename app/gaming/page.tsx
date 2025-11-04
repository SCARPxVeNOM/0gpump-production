"use client"

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ethers } from 'ethers'

export default function GamingPage() {
  const { address } = useAccount()
  const [activeTab, setActiveTab] = useState<'pumpplay'|'meme-royale'|'mines'|'arcade'|'roulette'>('pumpplay')
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
  
  // Platform Coins & User Holdings
  const [allCoins, setAllCoins] = useState<any[]>([])
  const [userCoins, setUserCoins] = useState<any[]>([])
  const [loadingCoins, setLoadingCoins] = useState(false)
  const [balanceChange, setBalanceChange] = useState<{amount: number, token: string} | null>(null)
  
  // PumpPlay State
  const [rounds, setRounds] = useState<any[]>([])
  const [selectedRound, setSelectedRound] = useState<any>(null)
  const [betCoin, setBetCoin] = useState<string>('')
  const [betToken, setBetToken] = useState<string>('')
  const [betAmount, setBetAmount] = useState<string>('0.5')
  const [isBetting, setIsBetting] = useState(false)
  
  // Meme Royale State
  const [battles, setBattles] = useState<any[]>([])
  const [leftCoin, setLeftCoin] = useState<any>(null)
  const [rightCoin, setRightCoin] = useState<any>(null)
  const [stakeSide, setStakeSide] = useState<'left'|'right'|''>('')
  const [stakeToken, setStakeToken] = useState<string>('')
  const [stakeAmount, setStakeAmount] = useState<string>('0.5')
  const [battleResult, setBattleResult] = useState<any>(null)
  const [isBattling, setIsBattling] = useState(false)
  
  // Mines State
  const [minesGame, setMinesGame] = useState<any>(null)
  const [minesCount, setMinesCount] = useState<number>(3)
  const [minesBet, setMinesBet] = useState<string>('0.5')
  const [minesToken, setMinesToken] = useState<string>('')
  const [revealedTiles, setRevealedTiles] = useState<number[]>([])
  const [minePositions, setMinePositions] = useState<number[]>([])
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0)
  const [gameStatus, setGameStatus] = useState<'idle'|'active'|'won'|'lost'|'cashed'>('idle')
  const [minesHistory, setMinesHistory] = useState<any[]>([])
  
  // Coinflip State
  const [coinflipResult, setCoinflipResult] = useState<any>(null)
  const [flipWager, setFlipWager] = useState<string>('0.1')
  const [flipGuess, setFlipGuess] = useState<'heads'|'tails'>('heads')
  const [flipToken, setFlipToken] = useState<string>('')
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [isFlipping, setIsFlipping] = useState(false)
  
  // Roulette State
  const [rouletteGame, setRouletteGame] = useState<any>(null)
  const [rouletteBets, setRouletteBets] = useState<{[key: string]: number}>({})
  const [rouletteToken, setRouletteToken] = useState<string>('')
  const [rouletteTotalBet, setRouletteTotalBet] = useState<number>(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [spinningNumber, setSpinningNumber] = useState<number | null>(null)
  const [wheelRotation, setWheelRotation] = useState<number>(0)
  const [rouletteHistory, setRouletteHistory] = useState<number[]>([])
  const [rouletteResult, setRouletteResult] = useState<any>(null)
  
  // 0G DA Provenance State
  const [lastProvenanceHash, setLastProvenanceHash] = useState<string|null>(null)
  
  // Wallet Balance Tracking
  const [nativeBalance, setNativeBalance] = useState<string>('0.0')
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  
  // Multiplayer Matchmaking State
  const [matchmakingStatus, setMatchmakingStatus] = useState<{
    gameType: string
    status: 'idle'|'waiting'|'matched'|'error'
    lobbyId?: string
    matchId?: string
    opponentAddress?: string
    message?: string
  }>({ gameType: '', status: 'idle' })
  const [matchType, setMatchType] = useState<'solo'|'p2p'|'pool'>('p2p') // Default to P2P for multiplayer
  const [matchmakingInterval, setMatchmakingInterval] = useState<NodeJS.Timeout | null>(null)

  // Load native OG balance
  const loadNativeBalance = async () => {
    if (!address) return
    try {
      setIsLoadingBalance(true)
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_OG_RPC || process.env.NEXT_PUBLIC_EVM_RPC || 'https://evmrpc.0g.ai')
      const balance = await provider.getBalance(address)
      setNativeBalance(ethers.formatEther(balance))
      setIsLoadingBalance(false)
    } catch (e) {
      console.error('Failed to load balance:', e)
      setIsLoadingBalance(false)
    }
  }

  // Auto-refresh native balance
  useEffect(() => {
    if (!address) return
    loadNativeBalance()
    const interval = setInterval(loadNativeBalance, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [address])

  // Load platform coins and user holdings with real-time balance updates
  const loadCoinsData = () => {
    if (!address) return
    setLoadingCoins(true)
    fetch(`${backend}/gaming/coins/${address}`)
      .then(r => r.json())
      .then(data => {
        setAllCoins(data.coins || [])
        setUserCoins(data.userHoldings || [])
        setLoadingCoins(false)
        console.log(`✅ Balance updated: ${data.totalCoins} coins, you hold ${data.coinsWithBalance}`)
        // Also refresh native balance
        loadNativeBalance()
      })
      .catch((e) => {
        console.error('Failed to load coins:', e)
        setLoadingCoins(false)
      })
  }

  useEffect(() => {
    if (!address) return
    loadCoinsData()
    const interval = setInterval(loadCoinsData, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [address, backend])

  // Load PumpPlay rounds
  useEffect(() => {
    if (activeTab !== 'pumpplay') return
    const loadRounds = () => {
      fetch(`${backend}/gaming/pumpplay/rounds`)
        .then(r => r.json())
        .then(data => setRounds(data.rounds || []))
        .catch(() => {})
    }
    loadRounds()
    const interval = setInterval(loadRounds, 10000)
    return () => clearInterval(interval)
  }, [activeTab, backend])

  // Load Meme Royale battles
  useEffect(() => {
    if (activeTab !== 'meme-royale') return
    const loadBattles = () => {
      fetch(`${backend}/gaming/meme-royale/battles`)
        .then(r => r.json())
        .then(data => setBattles(data.battles || []))
        .catch(() => {})
    }
    loadBattles()
    const interval = setInterval(loadBattles, 10000)
    return () => clearInterval(interval)
  }, [activeTab, backend, battleResult])

  // Load Coinflip leaderboard
  useEffect(() => {
    if (activeTab !== 'arcade') return
    const load = async () => {
      try {
        const [lb, rc] = await Promise.all([
          fetch(`${backend}/gaming/coinflip/leaderboard`).then(r=>r.json()),
          fetch(`${backend}/gaming/coinflip/recent`).then(r=>r.json())
        ])
        setLeaderboard(lb.leaderboard || [])
        setRecent(rc.recent || [])
      } catch {}
    }
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [activeTab, backend, coinflipResult])

  // Universal Matchmaking Function
  const startMatchmaking = async (gameType: string, gameParams: any, betAmount: number, tokenAddress: string, txHash: string) => {
    if (!address) return alert('Connect wallet first')
    
    setMatchmakingStatus({ gameType, status: 'waiting', message: 'Searching for opponent...' })
    
    try {
      const res = await fetch(`${backend}/gaming/matchmake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType,
          userAddress: address,
          betAmount,
          tokenAddress,
          txHash,
          gameParams,
          matchType: 'p2p'
        })
      })
      
      const data = await res.json()
      
      if (!data.success) {
        setMatchmakingStatus({ gameType, status: 'error', message: data.error || 'Matchmaking failed' })
        return false
      }
      
      if (data.matched) {
        // Match found!
        setMatchmakingStatus({
          gameType,
          status: 'matched',
          matchId: data.matchId,
          opponentAddress: data.opponentAddress,
          message: `Matched with ${data.opponentAddress.slice(0, 6)}...${data.opponentAddress.slice(-4)}!`
        })
        
        // Clear polling if any
        if (matchmakingInterval) {
          clearInterval(matchmakingInterval)
          setMatchmakingInterval(null)
        }
        
        return { matched: true, matchId: data.matchId, opponentAddress: data.opponentAddress, gameParams: data.gameParams }
      } else {
        // Waiting for opponent
        setMatchmakingStatus({
          gameType,
          status: 'waiting',
          lobbyId: data.lobbyId,
          message: 'Waiting for opponent to join...'
        })
        
        // Start polling for match status
        const pollInterval = setInterval(async () => {
          try {
            const checkRes = await fetch(`${backend}/gaming/lobbies/${gameType}?tokenAddress=${tokenAddress}&betAmount=${betAmount}`)
            const checkData = await checkRes.json()
            
            // Check if we found a match by looking for a lobby with our address as opponent
            const myLobby = checkData.lobbies?.find((l: any) => 
              l.lobbyId === data.lobbyId && l.opponentAddress === address.toLowerCase()
            )
            
            if (myLobby && myLobby.matchId) {
              clearInterval(pollInterval)
              setMatchmakingInterval(null)
              setMatchmakingStatus({
                gameType,
                status: 'matched',
                matchId: myLobby.matchId,
                opponentAddress: myLobby.creatorAddress,
                message: `Matched! Starting game...`
              })
            }
          } catch (e) {
            console.error('Polling error:', e)
          }
        }, 2000) // Poll every 2 seconds
        
        setMatchmakingInterval(pollInterval)
        
        // Auto-stop polling after 5 minutes
        setTimeout(() => {
          if (pollInterval) {
            clearInterval(pollInterval)
            setMatchmakingInterval(null)
            if (matchmakingStatus.status === 'waiting') {
              setMatchmakingStatus({ gameType, status: 'error', message: 'Matchmaking timed out' })
            }
          }
        }, 5 * 60 * 1000)
        
        return { matched: false, lobbyId: data.lobbyId }
      }
    } catch (e: any) {
      setMatchmakingStatus({ gameType, status: 'error', message: e.message || 'Matchmaking failed' })
      return false
    }
  }

  // Stop matchmaking
  const stopMatchmaking = () => {
    if (matchmakingInterval) {
      clearInterval(matchmakingInterval)
      setMatchmakingInterval(null)
    }
    setMatchmakingStatus({ gameType: '', status: 'idle' })
  }

  // PumpPlay: Place Bet
  const placeBet = async () => {
    if (!address || !selectedRound || !betCoin || !betToken) {
      return alert('Select round, coin to bet on, and token to stake')
    }
    
    setIsBetting(true)
    
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const tokenContract = new ethers.Contract(
        betToken,
        ['function transfer(address to, uint256 amount) returns (bool)', 'function balanceOf(address) view returns (uint256)'],
        signer
      )
      
      const amount = ethers.parseEther(betAmount)
      
      // Check balance
      const balance = await tokenContract.balanceOf(address)
      if (balance < amount) {
        alert('Insufficient token balance')
        setIsBetting(false)
        return
      }
      
      // Transfer stake to backend
      const backendWallet = '0x2dC274ABC0df37647CEd9212e751524708a68996'
      console.log('Transferring bet stake...')
      const tx = await tokenContract.transfer(backendWallet, amount)
      await tx.wait()
      console.log('Stake transferred:', tx.hash)
      
      let matchId = null
      let matchTypeFinal = matchType
      
      // P2P Matchmaking for PumpPlay
      if (matchType === 'p2p') {
        const matchResult = await startMatchmaking('pumpplay', { coinId: betCoin, roundId: selectedRound.id }, parseFloat(betAmount), betToken, tx.hash)
        
        if (matchResult && typeof matchResult === 'object' && 'matched' in matchResult) {
          if (matchResult.matched) {
            matchId = matchResult.matchId
            matchTypeFinal = 'p2p'
          } else {
            // Still waiting - will place bet once matched
            setIsBetting(false)
            return
          }
        }
      }
      
      // Record bet
      const res = await fetch(`${backend}/gaming/pumpplay/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: selectedRound.id,
          userAddress: address,
          coinId: betCoin,
          amount: parseFloat(betAmount),
          tokenAddress: betToken,
          txHash: tx.hash,
          matchId,
          matchType: matchTypeFinal
        })
      })
      const data = await res.json()
      if (data.success) {
        const coinSymbol = selectedRound.coinDetails?.find((c:any) => c.id == betCoin)?.symbol || betCoin
        const successMsg = matchTypeFinal === 'p2p'
          ? `✅ P2P Bet placed!\n\nMatched with opponent. You bet ${betAmount} tokens on ${coinSymbol}.\n\nWinner takes both stakes when round ends!`
          : `✅ Bet placed successfully!\n\nYou bet ${betAmount} tokens on ${coinSymbol}\n\nWait for round to end!`
        alert(successMsg)
        // Reload rounds and refresh balances
        fetch(`${backend}/gaming/pumpplay/rounds`).then(r => r.json()).then(d => setRounds(d.rounds || []))
        setTimeout(() => loadCoinsData(), 2000)
        setSelectedRound(null)
        setBetCoin('')
        setBetAmount('0.5')
      } else {
        alert(data.error || 'Bet failed')
      }
    } catch (e: any) {
      console.error('Bet error:', e)
      alert(e.message || 'Bet failed')
    } finally {
      setIsBetting(false)
    }
  }

  // Meme Royale: Start Battle
  const startBattle = async () => {
    if (!address) return alert('Connect wallet first')
    if (!leftCoin || !rightCoin) return alert('Select two coins to battle')
    if (leftCoin.id === rightCoin.id) return alert('Select different coins!')
    if (!stakeSide) return alert('Pick which side you think will win')
    if (!stakeToken) return alert('Select a token to stake')
    if (parseFloat(stakeAmount) <= 0) return alert('Stake amount must be > 0')
    
    setIsBattling(true)
    setBattleResult(null)
    
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const tokenContract = new ethers.Contract(
        stakeToken,
        ['function transfer(address to, uint256 amount) returns (bool)', 'function balanceOf(address) view returns (uint256)'],
        signer
      )
      
      const amount = ethers.parseEther(stakeAmount)
      
      const balance = await tokenContract.balanceOf(address)
      if (balance < amount) {
        alert('Insufficient token balance')
        setIsBattling(false)
        return
      }
      
      const backendWallet = '0x2dC274ABC0df37647CEd9212e751524708a68996'
      
      console.log('Transferring stake...')
      const transferTx = await tokenContract.transfer(backendWallet, amount)
      await transferTx.wait()
      console.log('Stake transferred:', transferTx.hash)
      
      let matchId = null
      let matchTypeFinal = matchType
      
      // P2P Matchmaking for Meme Royale
      if (matchType === 'p2p') {
        const matchResult = await startMatchmaking('meme-royale', { 
          leftCoinId: leftCoin.id, 
          rightCoinId: rightCoin.id, 
          stakeSide 
        }, parseFloat(stakeAmount), stakeToken, transferTx.hash)
        
        if (matchResult && typeof matchResult === 'object' && 'matched' in matchResult) {
          if (matchResult.matched) {
            matchId = matchResult.matchId
            matchTypeFinal = 'p2p'
          } else {
            // Still waiting - will start battle once matched
            setIsBattling(false)
            return
          }
        }
      }
      
      // Start AI battle
      const res = await fetch(`${backend}/gaming/meme-royale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          leftCoin, 
          rightCoin,
          userAddress: address,
          stakeAmount: parseFloat(stakeAmount),
          stakeSide,
          tokenAddress: stakeToken,
          txHash: transferTx.hash,
          matchId,
          matchType: matchTypeFinal
        })
      })
      const data = await res.json()
      setBattleResult(data)
      
      if (data.judged) {
        const userWon = (stakeSide === 'left' && data.winner === 'left') || (stakeSide === 'right' && data.winner === 'right')
        
        if (userWon) {
          const winMsg = matchTypeFinal === 'p2p'
            ? `🎉 YOU WON THE P2P BATTLE!\n\nWinner: ${data.winner === 'left' ? leftCoin.symbol : rightCoin.symbol}\n\nYou beat your opponent! Winner takes both stakes!\n\n✅ Game verified on 0G DA`
            : `🎉 YOUR FIGHTER WON!\n\nWinner: ${data.winner === 'left' ? leftCoin.symbol : rightCoin.symbol}\n\nPayout: ${parseFloat(stakeAmount) * 1.8} tokens (1.8x)!\nTx: ${data.payoutTx?.slice(0, 10)}...`
          alert(winMsg)
        } else {
          const loseMsg = matchTypeFinal === 'p2p'
            ? `😢 P2P Battle Lost\n\nWinner: ${data.winner === 'left' ? leftCoin.symbol : rightCoin.symbol}\n\nOpponent won! Better luck next time!\n\n✅ Game verified on 0G DA`
            : `😢 Your Fighter Lost\n\nWinner: ${data.winner === 'left' ? leftCoin.symbol : rightCoin.symbol}\n\nBetter luck next time!`
          alert(loseMsg)
        }
        
        // Refresh balances immediately after battle
        setTimeout(() => loadCoinsData(), 2000)
      }
      
    } catch (e: any) {
      console.error('Battle error:', e)
      alert(e.message || 'Battle failed')
    } finally {
      setIsBattling(false)
    }
  }

  // Coinflip: Play with real token
  const playCoinflip = async () => {
    if (!address) return alert('Connect wallet first')
    if (!flipToken) return alert('Select a token to stake')
    if (parseFloat(flipWager) <= 0) return alert('Wager must be > 0')
    
    setIsFlipping(true)
    setCoinflipResult(null)
    
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const tokenContract = new ethers.Contract(
        flipToken,
        ['function transfer(address to, uint256 amount) returns (bool)', 'function balanceOf(address) view returns (uint256)'],
        signer
      )
      
      const amount = ethers.parseEther(flipWager)
      
      const balance = await tokenContract.balanceOf(address)
      if (balance < amount) {
        alert('Insufficient token balance')
        setIsFlipping(false)
        return
      }
      
      const backendWallet = '0x2dC274ABC0df37647CEd9212e751524708a68996'
      
      console.log('Transferring stake...')
      const transferTx = await tokenContract.transfer(backendWallet, amount)
      await transferTx.wait()
      console.log('Stake transferred:', transferTx.hash)
      
      let matchId = null
      let matchTypeFinal = matchType
      
      // P2P Matchmaking
      if (matchType === 'p2p') {
        const matchResult = await startMatchmaking('coinflip', { guess: flipGuess }, parseFloat(flipWager), flipToken, transferTx.hash)
        
        if (matchResult && typeof matchResult === 'object' && 'matched' in matchResult) {
          if (matchResult.matched) {
            matchId = matchResult.matchId
            matchTypeFinal = 'p2p'
          } else {
            // Still waiting - user will flip once matched
            setIsFlipping(false)
            return
          }
        }
      }
      
      const res = await fetch(`${backend}/gaming/coinflip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userAddress: address, 
          wager: parseFloat(flipWager), 
          guess: flipGuess,
          tokenAddress: flipToken,
          txHash: transferTx.hash,
          matchId,
          matchType: matchTypeFinal
        })
      })
      const data = await res.json()
      setCoinflipResult(data)
      
      if (data.provenanceHash) {
        setLastProvenanceHash(data.provenanceHash)
      }
      
      if (data.outcome === 'win') {
        const payoutMsg = matchTypeFinal === 'p2p' 
          ? `🎉 YOU WON!\n\nP2P Match: You beat your opponent!\nResult: ${data.result.toUpperCase()}\nWinner takes both stakes!\n\n✅ Game verified on 0G DA`
          : `🎉 YOU WON!\n\nResult: ${data.result.toUpperCase()}\n\nPayout of ${parseFloat(flipWager) * 2} tokens sent!\nTx: ${data.payoutTx?.slice(0, 10)}...\n\n✅ Game verified on 0G DA`
        alert(payoutMsg)
      } else {
        const loseMsg = matchTypeFinal === 'p2p'
          ? `😢 You Lost\n\nP2P Match: Opponent won!\nResult: ${data.result.toUpperCase()}\nBetter luck next time!\n\n✅ Game verified on 0G DA`
          : `😢 You Lost\n\nResult: ${data.result.toUpperCase()}\n\nBetter luck next time!\n\n✅ Game verified on 0G DA`
        alert(loseMsg)
      }
      
      // Refresh balances immediately after game ends
      setTimeout(() => loadCoinsData(), 2000)
      
    } catch (e: any) {
      console.error('Coinflip error:', e)
      alert(e.message || 'Coinflip failed')
    } finally {
      setIsFlipping(false)
    }
  }

  // Roulette Handlers
  const handleRouletteBet = (betType: string, amount: number) => {
    if (!rouletteToken) {
      alert('Please select a token first')
      return
    }
    
    const currentBet = rouletteBets[betType] || 0
    const newBet = currentBet + amount
    setRouletteBets({ ...rouletteBets, [betType]: newBet })
    setRouletteTotalBet(rouletteTotalBet + amount)
  }

  const handleSpinRoulette = async () => {
    if (!address) return alert('Connect wallet first')
    if (!rouletteToken) return alert('Select a token to bet with')
    if (rouletteTotalBet === 0 || Object.keys(rouletteBets).length === 0) {
      return alert('Place at least one bet before spinning')
    }

    setIsSpinning(true)
    setRouletteResult(null)
    
    try {
      // Transfer tokens to backend
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const tokenContract = new ethers.Contract(
        rouletteToken,
        ['function transfer(address,uint256) returns (bool)'],
        signer
      )
      
      const amount = ethers.parseEther(rouletteTotalBet.toString())
      const transferTx = await tokenContract.transfer(backend, amount)
      await transferTx.wait()
      
      // Animate wheel spin
      const spins = 5 + Math.random() * 3 // 5-8 full spins
      const randomNumber = Math.floor(Math.random() * 37) // 0-36
      const finalRotation = 360 * spins + (randomNumber * 360 / 37)
      
      setWheelRotation(finalRotation)
      setIsSpinning(true)
      
      // Simulate ball moving during spin
      let currentPos = 0
      const spinInterval = setInterval(() => {
        currentPos = (currentPos + 1) % 37
        setSpinningNumber(currentPos)
      }, 50)
      
      // Call backend to get result
      const res = await fetch(`${backend}/gaming/roulette/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          bets: rouletteBets,
          totalBet: rouletteTotalBet,
          tokenAddress: rouletteToken,
          txHash: transferTx.hash
        })
      })
      
      const data = await res.json()
      
      // Wait for spin animation to complete
      setTimeout(() => {
        clearInterval(spinInterval)
        setSpinningNumber(data.winningNumber)
        setWheelRotation(finalRotation)
        setRouletteResult({
          number: data.winningNumber,
          color: data.color,
          parity: data.parity,
          winnings: data.winnings || 0
        })
        setRouletteHistory([...rouletteHistory, data.winningNumber])
        setIsSpinning(false)
        
        // Clear bets after result
        setRouletteBets({})
        setRouletteTotalBet(0)
        
        if (data.winnings > 0) {
          alert(`🎉 You won ${data.winnings.toFixed(4)} tokens!`)
        } else {
          alert(`😢 Ball landed on ${data.winningNumber}. Better luck next time!`)
        }
        
        // Refresh balances
        setTimeout(() => loadCoinsData(), 2000)
      }, 3000) // 3 second spin animation
      
    } catch (e: any) {
      console.error('Roulette spin error:', e)
      alert(e.message || 'Spin failed')
      setIsSpinning(false)
      setSpinningNumber(null)
    }
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-6 relative overflow-hidden">
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-20 left-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-5xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-transparent bg-clip-text drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] animate-pulse">
              🎮 GAMING ARENA 🎮
            </h1>
            <div className="flex gap-2 mt-3">
              <span className="bg-gradient-to-r from-green-400 to-emerald-600 text-white text-xs px-3 py-1.5 rounded-full border-2 border-green-300 shadow-[0_0_15px_rgba(34,197,94,0.5)] font-bold animate-bounce">
                ✅ 0G COMPUTE AI
              </span>
              <span className="bg-gradient-to-r from-blue-400 to-cyan-600 text-white text-xs px-3 py-1.5 rounded-full border-2 border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.5)] font-bold animate-bounce animation-delay-200">
                🔒 0G DA VERIFIED
              </span>
            </div>
          </div>
          
          {/* Wallet Connect & Balance Display - Neon Style */}
          <div className="flex items-center gap-4">
            {address && (
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-xl border-2 border-purple-400 rounded-2xl px-6 py-4 shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-xs text-cyan-300 font-bold tracking-wider">CONNECTED WALLET</div>
                    <div className="text-sm font-mono text-white font-black bg-gradient-to-r from-yellow-300 to-orange-400 text-transparent bg-clip-text">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </div>
                  </div>
                  <div className="h-12 w-px bg-gradient-to-b from-pink-500 to-cyan-500"></div>
                  <div>
                    <div className="text-xs text-pink-300 font-bold tracking-wider">OG BALANCE</div>
                    <div className="text-xl font-black text-green-400 flex items-center gap-1 drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]">
                      {isLoadingBalance ? (
                        <span className="animate-pulse">...</span>
                      ) : (
                        <>
                          <span>{parseFloat(nativeBalance).toFixed(4)}</span>
                          <span className="text-sm text-green-300">OG</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-12 w-px bg-gradient-to-b from-cyan-500 to-purple-500"></div>
                  <div>
                    <div className="text-xs text-purple-300 font-bold tracking-wider">TOKENS HELD</div>
                    <div className="text-xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
                      {userCoins.length}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <div className="[&>button]:bg-gradient-to-r [&>button]:from-pink-500 [&>button]:to-purple-600 [&>button]:border-2 [&>button]:border-pink-400 [&>button]:shadow-[0_0_20px_rgba(236,72,153,0.5)] [&>button]:hover:shadow-[0_0_35px_rgba(236,72,153,0.8)]">
                <ConnectButton />
              </div>
              <a href="/" className="text-cyan-400 hover:text-pink-400 font-bold text-sm text-center transition-colors duration-300 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">← HOME</a>
            </div>
          </div>
        </div>
        
        {/* 0G DA Provenance Verification - Neon Style */}
        {lastProvenanceHash && (
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-xl border-2 border-cyan-400 rounded-2xl p-5 mb-6 shadow-[0_0_30px_rgba(6,182,212,0.4)] animate-pulse">
            <div className="flex items-center gap-4">
              <div className="text-5xl animate-bounce drop-shadow-[0_0_10px_rgba(6,182,212,1)]">🔐</div>
              <div className="flex-1">
                <div className="font-black text-cyan-300 text-lg drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">GAME VERIFIED ON 0G DA</div>
                <div className="text-sm text-purple-300 font-semibold">Your last game result is permanently stored on decentralized storage</div>
                <div className="text-xs text-yellow-400 mt-1 font-mono break-all">{lastProvenanceHash}</div>
              </div>
              <a 
                href={`${backend}/gaming/verify/${lastProvenanceHash}`}
                target="_blank"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-cyan-400 hover:to-blue-500 text-sm font-black whitespace-nowrap border-2 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_35px_rgba(6,182,212,0.8)] transition-all duration-300"
              >
                VERIFY ↗
              </a>
            </div>
          </div>
        )}

        {/* Balance Change Notification - Neon Style */}
        {balanceChange && (
          <div className={`fixed top-20 right-6 z-50 ${balanceChange.amount > 0 ? 'bg-gradient-to-br from-green-400 to-emerald-600 border-green-300 shadow-[0_0_40px_rgba(34,197,94,0.8)]' : 'bg-gradient-to-br from-red-400 to-rose-600 border-red-300 shadow-[0_0_40px_rgba(239,68,68,0.8)]'} text-white px-8 py-5 rounded-2xl border-4 animate-bounce backdrop-blur-xl`}>
            <div className="text-3xl font-black drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
              {balanceChange.amount > 0 ? '🎉 +' : '😢 -'}{Math.abs(balanceChange.amount).toFixed(4)} {balanceChange.token}
            </div>
            <div className="text-base font-bold">{balanceChange.amount > 0 ? 'WINNING CREDITED!' : 'BET DEDUCTED'}</div>
          </div>
        )}

        {/* Platform Coins & Holdings Display - Neon Style */}
        <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border-2 border-pink-500 rounded-2xl p-6 mb-6 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-black text-transparent bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
              🎮 GAMING WITH PLATFORM COINS
            </h2>
            <div className="text-sm text-cyan-300 font-bold">
              {allCoins.length} COINS AVAILABLE • {userCoins.length} YOU HOLD
            </div>
          </div>
          {!address && <p className="text-purple-300 font-semibold">CONNECT WALLET TO VIEW YOUR COINS</p>}
          {address && loadingCoins && <p className="text-pink-300 animate-pulse font-semibold">LOADING PLATFORM COINS...</p>}
          {address && !loadingCoins && allCoins.length === 0 && (
            <p className="text-gray-500">No coins created yet. Create the first coin on the platform!</p>
          )}
          {allCoins.length > 0 && (
            <div>
              {userCoins.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-green-700 mb-2">✅ Your Holdings ({userCoins.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {userCoins.map((c, i) => (
                      <div key={i} className="bg-green-50 border-2 border-green-400 rounded-lg px-3 py-2">
                        <div className="font-bold text-sm">{c.symbol}</div>
                        <div className="text-xs text-gray-600">{parseFloat(c.balance).toFixed(4)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-blue-700 mb-2">📋 All Platform Coins ({allCoins.length})</h3>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {allCoins.slice(0, 20).map((c, i) => (
                    <div key={i} className={`border rounded-lg px-3 py-1 text-xs ${c.hasBalance ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="font-semibold">{c.symbol}</span> - {c.name}
                    </div>
                  ))}
                  {allCoins.length > 20 && <div className="text-xs text-gray-500 px-2">+{allCoins.length - 20} more...</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs - Neon Gaming Style */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('pumpplay')}
            className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'pumpplay'
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-[0_0_30px_rgba(59,130,246,0.6)] border-2 border-blue-400'
                : 'bg-gray-800/50 text-purple-300 hover:bg-gray-700/70 border-2 border-purple-500/30 backdrop-blur-sm'
            }`}
          >
            🎯 PUMPPLAY
          </button>
          <button
            onClick={() => setActiveTab('meme-royale')}
            className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'meme-royale'
                ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-[0_0_30px_rgba(236,72,153,0.6)] border-2 border-pink-400'
                : 'bg-gray-800/50 text-pink-300 hover:bg-gray-700/70 border-2 border-pink-500/30 backdrop-blur-sm'
            }`}
          >
            ⚔️ MEME ROYALE
          </button>
          <button
            onClick={() => setActiveTab('mines')}
            className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'mines'
                ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-[0_0_30px_rgba(249,115,22,0.6)] border-2 border-orange-400'
                : 'bg-gray-800/50 text-orange-300 hover:bg-gray-700/70 border-2 border-orange-500/30 backdrop-blur-sm'
            }`}
          >
            💣 MINES
          </button>
          <button
            onClick={() => setActiveTab('arcade')}
            className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'arcade'
                ? 'bg-gradient-to-r from-cyan-500 to-green-600 text-white shadow-[0_0_30px_rgba(6,182,212,0.6)] border-2 border-cyan-400'
                : 'bg-gray-800/50 text-cyan-300 hover:bg-gray-700/70 border-2 border-cyan-500/30 backdrop-blur-sm'
            }`}
          >
            🎰 COINFLIP
          </button>
          <button
            onClick={() => setActiveTab('roulette')}
            className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'roulette'
                ? 'bg-gradient-to-r from-yellow-500 via-red-600 to-pink-600 text-white shadow-[0_0_30px_rgba(234,179,8,0.6)] border-2 border-yellow-400'
                : 'bg-gray-800/50 text-yellow-300 hover:bg-gray-700/70 border-2 border-yellow-500/30 backdrop-blur-sm'
            }`}
          >
            🎡 ROULETTE
          </button>
        </div>

        {/* PumpPlay Tab - Neon Style */}
        {activeTab === 'pumpplay' && (
          <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 backdrop-blur-xl border-2 border-blue-500 rounded-3xl p-8 shadow-[0_0_40px_rgba(59,130,246,0.4)]">
            <h2 className="text-4xl font-black mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(147,51,234,0.8)]">
              🎯 PUMPPLAY - BET ON THE PUMP
            </h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 font-medium">
                ⚡ <strong>How it works:</strong> Pick which coin will pump the most in the next 15 minutes. 
                All bets go into a pool. Winners split the pool proportionally! Real tokens, real payouts.
              </p>
            </div>

            {rounds.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-center">
                <p className="text-yellow-800">⏳ Loading rounds or creating new one...</p>
              </div>
            )}

            {rounds.map((round) => (
              <div 
                key={round.id} 
                className={`border-2 rounded-lg p-5 mb-4 transition-all ${
                  selectedRound?.id === round.id 
                    ? 'border-blue-500 bg-blue-50 shadow-lg' 
                    : 'border-gray-200 hover:border-blue-300 cursor-pointer'
                }`}
                onClick={() => !selectedRound && setSelectedRound(round)}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-xl">Round #{round.id}</h3>
                  <div className="flex gap-3 items-center">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                      {round.status.toUpperCase()}
                    </span>
                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                      ⏱ {formatTime(round.timeRemaining)}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {round.coinDetails?.map((coin: any) => {
                    const totalBet = round.bets?.find((b: any) => b.coinId === coin.id)?.total || 0
                    const isSelected = betCoin == coin.id
                    return (
                      <div 
                        key={coin.id} 
                        className={`border-2 rounded-lg p-4 transition-all ${
                          isSelected ? 'border-blue-500 bg-blue-100' : 'border-gray-200 bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-lg">{coin.symbol}</div>
                        <div className="text-xs text-gray-500 mb-2">{coin.name}</div>
                        <div className="text-sm font-semibold text-green-600">
                          💰 Pool: {totalBet.toFixed(2)} tokens
                        </div>
                      </div>
                    )
                  })}
                </div>

                {selectedRound?.id === round.id && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-5 mt-4">
                    <h4 className="font-bold text-lg mb-4">🎲 Place Your Bet</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Which Coin Will Pump?</label>
                        <select
                          value={betCoin}
                          onChange={(e) => setBetCoin(e.target.value)}
                          className="w-full border-2 rounded-lg px-3 py-2 font-medium"
                          disabled={isBetting}
                        >
                          <option value="">Select coin...</option>
                          {round.coinDetails?.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.symbol} - {c.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold mb-2">Token to Stake</label>
                        <select
                          value={betToken}
                          onChange={(e) => setBetToken(e.target.value)}
                          className="w-full border-2 rounded-lg px-3 py-2 font-medium"
                          disabled={isBetting}
                        >
                          <option value="">Select your coin...</option>
                          {userCoins.map((c) => (
                            <option key={c.tokenAddress} value={c.tokenAddress}>
                              {c.symbol} ({parseFloat(c.balance).toFixed(4)}) - {c.name}
                            </option>
                          ))}
                        </select>
                        {userCoins.length === 0 && (
                          <p className="text-xs text-red-600 mt-1">You don't hold any coins. Buy some first!</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold mb-2">Amount</label>
                        <input
                          type="number"
                          value={betAmount}
                          onChange={(e) => setBetAmount(e.target.value)}
                          step="0.1"
                          min="0.1"
                          className="w-full border-2 rounded-lg px-3 py-2 font-medium"
                          disabled={isBetting}
                        />
                      </div>
                    </div>
                    
                    {/* Matchmaking Mode Selection */}
                    <div className="mb-4 flex gap-2">
                      <button
                        onClick={() => setMatchType('pool')}
                        className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                          matchType === 'pool'
                            ? 'bg-gray-800 text-white border-2 border-gray-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        🏊 Pool Mode
                      </button>
                      <button
                        onClick={() => setMatchType('p2p')}
                        className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                          matchType === 'p2p'
                            ? 'bg-blue-600 text-white border-2 border-blue-500'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        ⚔️ Find Match (P2P)
                      </button>
                    </div>

                    {/* Matchmaking Status */}
                    {matchmakingStatus.status === 'waiting' && matchmakingStatus.gameType === 'pumpplay' && (
                      <div className="mb-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-yellow-800">⏳ {matchmakingStatus.message}</div>
                            <div className="text-xs text-yellow-600 mt-1">Lobby ID: {matchmakingStatus.lobbyId}</div>
                          </div>
                          <button
                            onClick={stopMatchmaking}
                            className="px-3 py-1 bg-red-500 text-white rounded text-sm font-semibold hover:bg-red-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {matchmakingStatus.status === 'matched' && matchmakingStatus.gameType === 'pumpplay' && (
                      <div className="mb-4 bg-green-50 border-2 border-green-400 rounded-lg p-4">
                        <div className="font-bold text-green-800">
                          ✅ {matchmakingStatus.message}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          Match ID: {matchmakingStatus.matchId}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={placeBet}
                        disabled={!address || !betCoin || !betToken || isBetting || (matchmakingStatus.status === 'waiting' && matchmakingStatus.gameType === 'pumpplay')}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg"
                      >
                        {isBetting ? '🔄 Placing Bet...' : matchType === 'p2p' ? '⚔️ Find P2P Match' : '🎲 Place Bet Now!'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRound(null)
                          setBetCoin('')
                          setBetToken('')
                        }}
                        className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 font-semibold"
                        disabled={isBetting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">ℹ️ How Payouts Work</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• All bets go into a shared pool</li>
                <li>• When round ends, the coin that pumped most wins</li>
                <li>• Winners split the entire pool based on their bet size</li>
                <li>• Automatic payouts sent to your wallet</li>
              </ul>
            </div>
          </div>
        )}

        {/* Meme Royale Tab */}
        {activeTab === 'meme-royale' && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">⚔️ Meme Royale - AI Battle Arena</h2>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <p className="text-purple-800 font-medium">
                ⚡ <strong>How it works:</strong> Pick two coins to battle. AI judges them on virality, trend fit, and creativity. 
                Stake tokens on your pick - win = 1.8x payout! Powered by 0G Compute AI.
              </p>
            </div>

            {loadingCoins && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-blue-800">Loading coins...</p>
              </div>
            )}

            {!loadingCoins && allCoins.length === 0 && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-800">No coins available. Create some coins first!</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className={`border-2 rounded-lg p-5 ${stakeSide === 'left' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <h3 className="font-bold text-lg mb-3">🥊 Left Fighter</h3>
                <select
                  value={leftCoin?.id?.toString() || leftCoin?.id || ''}
                  onChange={(e) => {
                    const selectedValue = e.target.value
                    if (!selectedValue) {
                      setLeftCoin(null)
                      return
                    }
                    // Try multiple ways to match the coin
                    const coin = allCoins.find(c => {
                      const cId = c.id?.toString() || c.id
                      const sVal = selectedValue?.toString()
                      return cId === sVal || 
                             c.id === parseInt(selectedValue) || 
                             String(c.id) === String(selectedValue)
                    })
                    if (coin) {
                      setLeftCoin(coin)
                      console.log('✅ Left coin selected:', coin.symbol, coin.name, 'ID:', coin.id)
                    } else {
                      console.error('❌ Coin not found for value:', selectedValue)
                      console.error('Available coins:', allCoins.map(c => ({ id: c.id, idType: typeof c.id, symbol: c.symbol })))
                      alert(`Failed to find coin. Please refresh the page and try again.`)
                    }
                  }}
                  className="w-full border-2 rounded-lg px-3 py-2 mb-3 font-medium"
                  disabled={isBattling || loadingCoins || allCoins.length === 0}
                >
                  <option value="">Select fighter...</option>
                  {allCoins.map((c, idx) => {
                    const coinId = c.id?.toString() || c.id || idx
                    return (
                      <option key={coinId} value={coinId}>
                        {c.symbol} - {c.name} {c.hasBalance ? '✓' : ''}
                      </option>
                    )
                  })}
                </select>
                {leftCoin ? (
                  <div className="bg-white border-2 rounded-lg p-4 mt-3">
                    <div className="font-bold text-xl text-blue-600">{leftCoin.symbol || 'Unknown'}</div>
                    <div className="text-sm text-gray-600 mb-2">{leftCoin.name || 'Unknown Coin'}</div>
                    <button
                      onClick={() => setStakeSide('left')}
                      disabled={isBattling}
                      className={`w-full py-2 rounded-lg font-semibold transition-all ${
                        stakeSide === 'left' 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {stakeSide === 'left' ? '✅ Betting on LEFT' : 'Bet on LEFT'}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 mt-2 italic text-center py-2">
                    👆 Select a coin from dropdown above
                  </div>
                )}
              </div>

              <div className={`border-2 rounded-lg p-5 ${stakeSide === 'right' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                <h3 className="font-bold text-lg mb-3">🥊 Right Fighter</h3>
                <select
                  value={rightCoin?.id?.toString() || rightCoin?.id || ''}
                  onChange={(e) => {
                    const selectedValue = e.target.value
                    if (!selectedValue) {
                      setRightCoin(null)
                      return
                    }
                    // Try multiple ways to match the coin
                    const coin = allCoins.find(c => {
                      const cId = c.id?.toString() || c.id
                      const sVal = selectedValue?.toString()
                      return cId === sVal || 
                             c.id === parseInt(selectedValue) || 
                             String(c.id) === String(selectedValue)
                    })
                    if (coin) {
                      setRightCoin(coin)
                      console.log('✅ Right coin selected:', coin.symbol, coin.name, 'ID:', coin.id)
                    } else {
                      console.error('❌ Coin not found for value:', selectedValue)
                      console.error('Available coins:', allCoins.map(c => ({ id: c.id, idType: typeof c.id, symbol: c.symbol })))
                      alert(`Failed to find coin. Please refresh the page and try again.`)
                    }
                  }}
                  className="w-full border-2 rounded-lg px-3 py-2 mb-3 font-medium"
                  disabled={isBattling || loadingCoins || allCoins.length === 0}
                >
                  <option value="">Select fighter...</option>
                  {allCoins.map((c, idx) => {
                    const coinId = c.id?.toString() || c.id || idx
                    return (
                      <option key={coinId} value={coinId}>
                        {c.symbol} - {c.name} {c.hasBalance ? '✓' : ''}
                      </option>
                    )
                  })}
                </select>
                {rightCoin ? (
                  <div className="bg-white border-2 rounded-lg p-4 mt-3">
                    <div className="font-bold text-xl text-purple-600">{rightCoin.symbol || 'Unknown'}</div>
                    <div className="text-sm text-gray-600 mb-2">{rightCoin.name || 'Unknown Coin'}</div>
                    <button
                      onClick={() => setStakeSide('right')}
                      disabled={isBattling}
                      className={`w-full py-2 rounded-lg font-semibold transition-all ${
                        stakeSide === 'right' 
                          ? 'bg-purple-600 text-white shadow-lg' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {stakeSide === 'right' ? '✅ Betting on RIGHT' : 'Bet on RIGHT'}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 mt-2 italic text-center py-2">
                    👆 Select a coin from dropdown above
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2">Token to Stake</label>
                <select
                  value={stakeToken}
                  onChange={(e) => setStakeToken(e.target.value)}
                  className="w-full border-2 rounded-lg px-3 py-2 font-medium"
                  disabled={isBattling}
                >
                  <option value="">Select your coin...</option>
                  {userCoins.map((c) => (
                    <option key={c.tokenAddress} value={c.tokenAddress}>
                      {c.symbol} ({parseFloat(c.balance).toFixed(4)}) - {c.name}
                    </option>
                  ))}
                </select>
                {userCoins.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">You don't hold any coins. Buy some first!</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">Stake Amount</label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  step="0.1"
                  min="0.1"
                  className="w-full border-2 rounded-lg px-3 py-2 font-medium"
                  disabled={isBattling}
                />
              </div>
            </div>

            {/* Matchmaking Mode Selection */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setMatchType('solo')}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                  matchType === 'solo'
                    ? 'bg-gray-800 text-white border-2 border-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🎮 Auto Battle
              </button>
              <button
                onClick={() => setMatchType('p2p')}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                  matchType === 'p2p'
                    ? 'bg-red-600 text-white border-2 border-red-500'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ⚔️ Find Match (P2P)
              </button>
            </div>

            {/* Matchmaking Status */}
            {matchmakingStatus.status === 'waiting' && matchmakingStatus.gameType === 'meme-royale' && (
              <div className="mb-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-yellow-800">⏳ {matchmakingStatus.message}</div>
                    <div className="text-xs text-yellow-600 mt-1">Lobby ID: {matchmakingStatus.lobbyId}</div>
                  </div>
                  <button
                    onClick={stopMatchmaking}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm font-semibold hover:bg-red-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {matchmakingStatus.status === 'matched' && matchmakingStatus.gameType === 'meme-royale' && (
              <div className="mb-4 bg-green-50 border-2 border-green-400 rounded-lg p-4">
                <div className="font-bold text-green-800">
                  ✅ {matchmakingStatus.message}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Match ID: {matchmakingStatus.matchId}
                </div>
              </div>
            )}

            <button
              onClick={startBattle}
              disabled={!address || !leftCoin || !rightCoin || !stakeSide || !stakeToken || isBattling || (matchmakingStatus.status === 'waiting' && matchmakingStatus.gameType === 'meme-royale')}
              className="bg-gradient-to-r from-red-600 to-purple-600 text-white px-10 py-4 rounded-lg hover:from-red-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-lg mb-6"
            >
              {isBattling ? '🔄 AI Judging Battle...' : matchType === 'p2p' ? '⚔️ Find P2P Match' : '⚔️ START BATTLE!'}
            </button>

            {battleResult && battleResult.judged && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-400 rounded-lg p-6 mb-6">
                <h3 className="text-2xl font-bold mb-4 text-center">🏆 Battle Results - AI Judge</h3>
                
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div className={`border-2 rounded-lg p-4 ${battleResult.winner === 'left' ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                    <div className="font-bold text-xl mb-2">{leftCoin.symbol}</div>
                    <div className="text-4xl font-bold text-blue-600 mb-2">{battleResult.judged.left?.total || 0}/30</div>
                    <div className="text-xs space-y-1 text-gray-700">
                      <div>Virality: {battleResult.judged.left?.virality || 0}/10</div>
                      <div>Trend: {battleResult.judged.left?.trend || 0}/10</div>
                      <div>Creativity: {battleResult.judged.left?.creativity || 0}/10</div>
                    </div>
                    <div className="text-sm text-gray-600 mt-3 italic">
                      "{battleResult.judged.left?.reasons || 'No reasons'}"
                    </div>
                  </div>
                  
                  <div className={`border-2 rounded-lg p-4 ${battleResult.winner === 'right' ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                    <div className="font-bold text-xl mb-2">{rightCoin.symbol}</div>
                    <div className="text-4xl font-bold text-purple-600 mb-2">{battleResult.judged.right?.total || 0}/30</div>
                    <div className="text-xs space-y-1 text-gray-700">
                      <div>Virality: {battleResult.judged.right?.virality || 0}/10</div>
                      <div>Trend: {battleResult.judged.right?.trend || 0}/10</div>
                      <div>Creativity: {battleResult.judged.right?.creativity || 0}/10</div>
                    </div>
                    <div className="text-sm text-gray-600 mt-3 italic">
                      "{battleResult.judged.right?.reasons || 'No reasons'}"
                    </div>
                  </div>
                </div>

                <div className="text-center bg-white border-2 border-green-500 rounded-lg p-4">
                  <div className="text-2xl font-bold mb-2">
                    🏆 WINNER: <span className="text-green-600">
                      {battleResult.winner === 'left' ? leftCoin.symbol : rightCoin.symbol}
                    </span>
                  </div>
                  {battleResult.payoutTx && (
                    <div className="text-green-700 font-semibold">
                      💰 You won {parseFloat(stakeAmount) * 1.8} tokens!
                      <div className="text-xs text-gray-600 font-mono mt-1">
                        Tx: {battleResult.payoutTx.slice(0, 10)}...{battleResult.payoutTx.slice(-8)}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">Judged by 0G Compute AI</div>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-3 text-lg">📜 Recent Battles</h3>
              <div className="space-y-2">
                {battles.map((b) => (
                  <div key={b.id} className="bg-slate-50 border rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{b.leftSymbol}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="font-semibold">{b.rightSymbol}</span>
                    </div>
                    <div className="text-sm flex items-center gap-3">
                      <span className={b.leftScore > b.rightScore ? 'text-green-600 font-bold' : 'text-gray-500'}>
                        {b.leftScore}
                      </span>
                      <span className="text-gray-400">-</span>
                      <span className={b.rightScore > b.leftScore ? 'text-green-600 font-bold' : 'text-gray-500'}>
                        {b.rightScore}
                      </span>
                      <span className="text-xs text-gray-500">
                        🏆 {b.leftScore > b.rightScore ? b.leftSymbol : b.rightSymbol}
                      </span>
                    </div>
                  </div>
                ))}
                {battles.length === 0 && <p className="text-gray-500 text-center py-4">No battles yet - be the first!</p>}
              </div>
            </div>

            <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 mb-2">ℹ️ Battle Rules</h3>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>• AI judges coins on 3 criteria: Virality, Trend Fit, Creativity (each 0-10)</li>
                <li>• Highest total score wins the battle</li>
                <li>• Win your bet = 1.8x payout (house takes 10% fee)</li>
                <li>• Powered by 0G Compute AI - decentralized GPU network</li>
              </ul>
            </div>
          </div>
        )}

        {/* Mines Tab */}
        {activeTab === 'mines' && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">💣 Mines - Reveal & Win</h2>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <p className="text-orange-800 font-medium">
                ⚡ <strong>How it works:</strong> Click tiles to reveal gems 💎. Avoid bombs 💣! Cash out anytime with progressive multipliers. More mines = higher risk & reward!
              </p>
            </div>

            {gameStatus === 'idle' && (
              <div className="max-w-2xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Mines Count</label>
                    <select value={minesCount} onChange={(e) => setMinesCount(parseInt(e.target.value))} className="w-full border-2 rounded-lg px-3 py-2 font-medium">
                      {[1, 3, 5, 10, 15, 20, 24].map(n => (<option key={n} value={n}>{n} Mines ({(n/25*100).toFixed(0)}%)</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Token to Stake</label>
                    <select value={minesToken} onChange={(e) => setMinesToken(e.target.value)} className="w-full border-2 rounded-lg px-3 py-2 font-medium">
                      <option value="">Select coin...</option>
                      {userCoins.map((c) => (<option key={c.tokenAddress} value={c.tokenAddress}>{c.symbol} ({parseFloat(c.balance).toFixed(4)})</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Bet Amount</label>
                    <input type="number" value={minesBet} onChange={(e) => setMinesBet(e.target.value)} step="0.1" min="0.1" className="w-full border-2 rounded-lg px-3 py-2 font-medium" />
                  </div>
                </div>

                {/* Matchmaking Mode Selection */}
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => setMatchType('solo')}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                      matchType === 'solo'
                        ? 'bg-gray-800 text-white border-2 border-gray-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    🎮 Play Solo
                  </button>
                  <button
                    onClick={() => setMatchType('p2p')}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                      matchType === 'p2p'
                        ? 'bg-orange-600 text-white border-2 border-orange-500'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    ⚔️ Find Match (P2P)
                  </button>
                </div>

                {/* Matchmaking Status */}
                {matchmakingStatus.status === 'waiting' && matchmakingStatus.gameType === 'mines' && (
                  <div className="mb-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-yellow-800">⏳ {matchmakingStatus.message}</div>
                        <div className="text-xs text-yellow-600 mt-1">Lobby ID: {matchmakingStatus.lobbyId}</div>
                      </div>
                      <button
                        onClick={stopMatchmaking}
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm font-semibold hover:bg-red-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {matchmakingStatus.status === 'matched' && matchmakingStatus.gameType === 'mines' && (
                  <div className="mb-4 bg-green-50 border-2 border-green-400 rounded-lg p-4">
                    <div className="font-bold text-green-800">
                      ✅ {matchmakingStatus.message}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      Match ID: {matchmakingStatus.matchId}
                    </div>
                  </div>
                )}

                <button
                  onClick={async () => {
                    if (!address || !minesToken || parseFloat(minesBet) <= 0) return alert('Connect wallet and select token/amount')
                    
                    try {
                      const provider = new ethers.BrowserProvider((window as any).ethereum)
                      const signer = await provider.getSigner()
                      const tokenContract = new ethers.Contract(minesToken, ['function transfer(address to, uint256 amount) returns (bool)'], signer)
                      const amount = ethers.parseEther(minesBet)
                      const tx = await tokenContract.transfer('0x2dC274ABC0df37647CEd9212e751524708a68996', amount)
                      await tx.wait()

                      if (matchType === 'p2p') {
                        // P2P Matchmaking
                        const matchResult = await startMatchmaking('mines', { minesCount }, parseFloat(minesBet), minesToken, tx.hash)
                        
                        if (matchResult && typeof matchResult === 'object' && 'matched' in matchResult) {
                          if (matchResult.matched) {
                            // Start game with matchId
                            const res = await fetch(`${backend}/gaming/mines/matchmake`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                userAddress: address,
                                betAmount: parseFloat(minesBet),
                                minesCount,
                                tokenAddress: minesToken,
                                txHash: tx.hash,
                                matchType: 'p2p'
                              })
                            })
                            const data = await res.json()
                            if (data.success && data.matched) {
                              setMinesGame(data)
                              setGameStatus('active')
                              setRevealedTiles([])
                              setMinePositions([])
                              setCurrentMultiplier(1.0)
                            }
                          }
                          // If not matched yet, will wait and poll
                        }
                      } else {
                        // Solo mode
                        const res = await fetch(`${backend}/gaming/mines/start`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            userAddress: address,
                            betAmount: parseFloat(minesBet),
                            minesCount,
                            tokenAddress: minesToken,
                            txHash: tx.hash
                          })
                        })
                        const data = await res.json()
                        if (data.success) {
                          setMinesGame(data)
                          setGameStatus('active')
                          setRevealedTiles([])
                          setMinePositions([])
                          setCurrentMultiplier(1.0)
                        }
                      }
                    } catch (e: any) {
                      alert(e.message || 'Failed')
                    }
                  }}
                  disabled={!address || !minesToken || matchmakingStatus.status === 'waiting'}
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white px-8 py-4 rounded-lg hover:from-orange-700 hover:to-red-700 disabled:opacity-50 font-bold text-lg shadow-lg"
                >
                  {matchType === 'p2p' ? '⚔️ Find P2P Match' : '💣 Start Solo Game'}
                </button>
              </div>
            )}

              {gameStatus === 'active' && (
                <div>
                  <div className="flex justify-between items-center mb-6 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-lg p-4">
                    <div>
                      <div className="text-sm text-gray-600">Multiplier</div>
                      <div className="text-3xl font-bold text-orange-600">{(currentMultiplier ?? 1.0).toFixed(2)}x</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Potential Win</div>
                      <div className="text-2xl font-bold text-green-600">{(parseFloat(minesBet || '0') * (currentMultiplier ?? 1.0)).toFixed(4)}</div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`${backend}/gaming/mines/cashout`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ gameId: minesGame?.gameId })
                          });
                          const data = await res.json();
                          if (!data?.success) {
                            alert(data?.error || 'Cashout failed');
                            return;
                          }
                          const amt = typeof data.cashoutAmount === 'number' ? data.cashoutAmount : parseFloat(data.cashoutAmount || '0');
                          setGameStatus('cashed');
                          alert(`💰 Cashed out ${amt.toFixed(4)} tokens!`);
                          setTimeout(() => loadCoinsData(), 2000);
                        } catch (e: any) {
                          alert(e?.message || 'Cashout error');
                        }
                      }}
                      disabled={(revealedTiles?.length ?? 0) === 0 || !minesGame?.gameId}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold"
                    >
                      💰 Cash Out
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {Array.from({ length: 25 }, (_, i) => {
                      const isRevealed = (revealedTiles || []).includes(i);
                      const isMine = (minePositions || []).includes(i);
                      return (
                        <button
                          key={i}
                          onClick={async () => {
                            if (isRevealed) return;
                            try {
                              const res = await fetch(`${backend}/gaming/mines/reveal`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ gameId: minesGame?.gameId, tileIndex: i })
                              });
                              const data = await res.json();
                              if (!data?.success) {
                                alert(data?.error || 'Reveal failed');
                                return;
                              }
                              if (data.hitMine) {
                                setRevealedTiles(data.revealedTiles || []);
                                setMinePositions(data.minePositions || []);
                                setGameStatus('lost');
                                alert('💥 BOOM!');
                              } else {
                                setRevealedTiles(data.revealedTiles || []);
                                setCurrentMultiplier(data.currentMultiplier ?? currentMultiplier ?? 1.0);
                                if (data.status === 'won') {
                                  setMinePositions(data.minePositions || []);
                                  setGameStatus('won');
                                  alert('🎉 WON!');
                                }
                              }
                            } catch (e: any) {
                              alert(e?.message || 'Reveal error');
                            }
                          }}
                          disabled={isRevealed}
                          className={`aspect-square text-2xl font-bold rounded-lg transition-all ${isRevealed ? (isMine ? 'bg-red-500 text-white' : 'bg-green-500 text-white') : 'bg-gray-200 hover:bg-gray-300 active:scale-95'}`}
                        >
                          {isRevealed ? (isMine ? '💣' : '💎') : '?'}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-center text-sm text-gray-600">{(revealedTiles?.length ?? 0)} / {25 - minesCount} revealed</div>
                </div>
              )}

            {(gameStatus === 'lost' || gameStatus === 'won' || gameStatus === 'cashed') && (<div className="text-center"><div className={`text-4xl font-bold mb-4 ${gameStatus === 'won' || gameStatus === 'cashed' ? 'text-green-600' : 'text-red-600'}`}>{gameStatus === 'won' && '🎉 PERFECT!'}{gameStatus === 'lost' && '💥 BOOM!'}{gameStatus === 'cashed' && '💰 Cashed Out!'}</div><div className="grid grid-cols-5 gap-2 mb-6">{Array.from({ length: 25 }, (_, i) => (<div key={i} className={`aspect-square text-2xl font-bold rounded-lg flex items-center justify-center ${minePositions.includes(i) ? 'bg-red-500 text-white' : 'bg-green-500 text-white opacity-40'}`}>{minePositions.includes(i) ? '💣' : revealedTiles.includes(i) ? '💎' : ''}</div>))}</div><button onClick={() => { setGameStatus('idle'); setMinesGame(null); setRevealedTiles([]); setMinePositions([]); setCurrentMultiplier(1.0); }} className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-bold">Play Again</button></div>)}

            <div className="mt-8 bg-orange-50 border border-orange-200 rounded-lg p-4"><h3 className="font-semibold text-orange-900 mb-2">ℹ️ How It Works</h3><ul className="text-sm text-orange-800 space-y-1"><li>• Progressive multipliers: Each safe tile increases your payout</li><li>• More mines = Higher multipliers but higher risk</li><li>• Cash out anytime to secure winnings!</li></ul></div>
          </div>
        )}

        {/* AI Arcade Tab */}
        {activeTab === 'arcade' && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">🎰 AI Arcade - Coinflip</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 font-medium">
                ⚡ <strong>How it works:</strong> Stake your tokens, pick heads or tails. 
                Win = Auto 2x payout sent directly to your wallet! 
                Results verified with OG chain blockhash entropy.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Pick Side</label>
                <select
                  value={flipGuess}
                  onChange={(e) => setFlipGuess(e.target.value as 'heads'|'tails')}
                  className="w-full border rounded px-3 py-2"
                  disabled={isFlipping}
                >
                  <option value="heads">🪙 Heads</option>
                  <option value="tails">🎯 Tails</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Token to Stake</label>
                <select
                  value={flipToken}
                  onChange={(e) => setFlipToken(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  disabled={isFlipping}
                >
                  <option value="">Select your coin...</option>
                  {userCoins.map((c) => (
                    <option key={c.tokenAddress} value={c.tokenAddress}>
                      {c.symbol} ({parseFloat(c.balance).toFixed(4)}) - {c.name}
                    </option>
                  ))}
                </select>
                {userCoins.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">Buy some coins first!</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Wager Amount</label>
                <input
                  type="number"
                  value={flipWager}
                  onChange={(e) => setFlipWager(e.target.value)}
                  step="0.1"
                  min="0.1"
                  className="w-full border rounded px-3 py-2"
                  disabled={isFlipping}
                />
              </div>
            </div>

            {/* Matchmaking Mode Selection */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setMatchType('solo')}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                  matchType === 'solo'
                    ? 'bg-gray-800 text-white border-2 border-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🎮 Play Solo
              </button>
              <button
                onClick={() => setMatchType('p2p')}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                  matchType === 'p2p'
                    ? 'bg-blue-600 text-white border-2 border-blue-500'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ⚔️ Find Match (P2P)
              </button>
            </div>

            {/* Matchmaking Status */}
            {matchmakingStatus.status === 'waiting' && matchmakingStatus.gameType === 'coinflip' && (
              <div className="mb-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-yellow-800">⏳ {matchmakingStatus.message}</div>
                    <div className="text-xs text-yellow-600 mt-1">Lobby ID: {matchmakingStatus.lobbyId}</div>
                  </div>
                  <button
                    onClick={stopMatchmaking}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm font-semibold hover:bg-red-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {matchmakingStatus.status === 'matched' && matchmakingStatus.gameType === 'coinflip' && (
              <div className="mb-4 bg-green-50 border-2 border-green-400 rounded-lg p-4">
                <div className="font-bold text-green-800">
                  ✅ {matchmakingStatus.message}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Match ID: {matchmakingStatus.matchId}
                </div>
              </div>
            )}

            <button
              onClick={playCoinflip}
              disabled={!address || !flipToken || isFlipping || (matchmakingStatus.status === 'waiting' && matchmakingStatus.gameType === 'coinflip')}
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-6 font-bold text-lg shadow-lg"
            >
              {isFlipping ? '🔄 Flipping...' : matchType === 'p2p' ? '⚔️ Find P2P Match' : '🪙 Flip Now!'}
            </button>

            {coinflipResult && (
              <div className={`border-2 rounded-lg p-6 mb-6 ${coinflipResult.outcome === 'win' ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
                <div className="text-center">
                  <h3 className="text-3xl font-bold mb-2">
                    {coinflipResult.outcome === 'win' ? '🎉 YOU WON! 🎉' : '😢 You Lost'}
                  </h3>
                  <div className="text-6xl my-4">
                    {coinflipResult.result === 'heads' ? '🪙' : '🎯'}
                  </div>
                  <div className="text-2xl font-bold mb-2">
                    Result: <span className="text-purple-600">{coinflipResult.result.toUpperCase()}</span>
                  </div>
                  {coinflipResult.outcome === 'win' && (
                    <div className="bg-white border-2 border-green-500 rounded-lg p-4 mt-4">
                      <div className="text-lg font-semibold text-green-700">
                        💰 Payout: {parseFloat(flipWager) * 2} tokens
                      </div>
                      {coinflipResult.payoutTx && (
                        <div className="text-sm text-gray-600 mt-2">
                          Tx: <span className="font-mono">{coinflipResult.payoutTx.slice(0, 10)}...{coinflipResult.payoutTx.slice(-8)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 mt-4">
                    <div>Block #{coinflipResult.blockNumber}</div>
                    <div className="font-mono text-xs">Hash: {coinflipResult.blockHash?.slice(0, 20)}...</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="font-semibold mb-2 text-lg">🏆 Leaderboard</h3>
                <div className="text-sm bg-slate-50 p-3 rounded border max-h-64 overflow-auto">
                  {leaderboard.map((r,i)=> (
                    <div key={i} className={`flex justify-between py-2 ${i < 3 ? 'font-bold' : ''}`}>
                      <span>
                        {i === 0 && '🥇 '}
                        {i === 1 && '🥈 '}
                        {i === 2 && '🥉 '}
                        <span className="font-mono">{r.userAddress.slice(0,6)}…{r.userAddress.slice(-4)}</span>
                      </span>
                      <span className="text-green-600">{r.wins}W / <span className="text-red-600">{r.losses}L</span> ({r.plays})</span>
                    </div>
                  ))}
                  {leaderboard.length===0 && <div className="text-slate-500 py-4 text-center">No plays yet - be the first!</div>}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-lg">📜 Recent Plays</h3>
                <div className="text-sm bg-slate-50 p-3 rounded border max-h-64 overflow-auto">
                  {recent.map((r,i)=> (
                    <div key={i} className="flex justify-between py-2">
                      <span className="font-mono">{r.userAddress.slice(0,6)}…{r.userAddress.slice(-4)}</span>
                      <span className={r.outcome === 'win' ? 'text-green-600 font-semibold' : 'text-red-600'}>
                        {r.outcome.toUpperCase()} • {r.wager}
                      </span>
                    </div>
                  ))}
                  {recent.length===0 && <div className="text-slate-500 py-4 text-center">No recent plays</div>}
                </div>
              </div>
            </div>

            <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">ℹ️ Fair Play Guarantee</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Results determined by OG blockchain blockhash (verifiable)</li>
                <li>• Automatic 2x payout on wins - sent directly to your wallet</li>
                <li>• No house edge - pure 50/50 odds</li>
                <li>• All transactions on-chain and transparent</li>
              </ul>
            </div>
          </div>
        )}

        {/* Roulette Tab - Visually Stunning */}
        {activeTab === 'roulette' && (
          <div className="bg-gradient-to-br from-yellow-900/40 via-red-900/40 to-pink-900/40 backdrop-blur-xl border-2 border-yellow-500 rounded-3xl p-8 shadow-[0_0_40px_rgba(234,179,8,0.4)]">
            <h2 className="text-4xl font-black mb-6 bg-gradient-to-r from-yellow-400 via-red-400 to-pink-400 text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]">
              🎡 ROULETTE - SPIN TO WIN
            </h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-yellow-800 font-medium">
                ⚡ <strong>How it works:</strong> Place bets on numbers, colors, or ranges. 
                Spin the wheel and win based on where the ball lands! Multiple betting options with different odds.
                Real tokens, real payouts verified on 0G DA.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Roulette Wheel */}
              <div className="lg:col-span-2">
                <div className="bg-black/90 rounded-3xl p-8 border-4 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.6)]">
                  <div className="relative mx-auto" style={{ width: '500px', height: '500px' }}>
                    {/* Roulette Wheel Container */}
                    <div 
                      className="relative mx-auto rounded-full border-8 border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.8),inset_0_0_50px_rgba(0,0,0,0.5)]"
                      style={{
                        width: '450px',
                        height: '450px',
                        background: 'radial-gradient(circle, #1a1a1a 0%, #000 100%)',
                        transform: `rotate(${wheelRotation}deg)`,
                        transition: isSpinning ? 'none' : 'transform 0.3s ease-out'
                      }}
                    >
                      {/* Wheel Numbers - European Roulette (0-36) */}
                      <div className="absolute inset-0">
                        {[...Array(37)].map((_, i) => {
                          const angle = (i * 360 / 37) - 90
                          const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(i)
                          const isBlack = ![0].includes(i) && !isRed
                          const radius = 200
                          const x = 225 + radius * Math.cos((angle * Math.PI) / 180)
                          const y = 225 + radius * Math.sin((angle * Math.PI) / 180)
                          
                          return (
                            <div
                              key={i}
                              className={`absolute w-12 h-12 rounded-full flex items-center justify-center font-black text-white border-2 border-white shadow-lg ${
                                i === 0 ? 'bg-green-500' : isRed ? 'bg-red-600' : 'bg-black'
                              }`}
                              style={{
                                left: `${x - 24}px`,
                                top: `${y - 24}px`,
                                transform: `rotate(${-wheelRotation}deg)`
                              }}
                            >
                              <span className="text-sm">{i}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Center Pointer */}
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4 z-20">
                        <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px] border-t-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,1)]"></div>
                      </div>

                      {/* Ball Indicator */}
                      {spinningNumber !== null && (
                        <div 
                          className="absolute w-8 h-8 rounded-full bg-white border-4 border-yellow-400 shadow-[0_0_20px_rgba(255,255,255,0.8)] z-30 animate-pulse"
                          style={{
                            left: `${225 + 180 * Math.cos(((spinningNumber * 360 / 37 - 90) * Math.PI) / 180) - 16}px`,
                            top: `${225 + 180 * Math.sin(((spinningNumber * 360 / 37 - 90) * Math.PI) / 180) - 16}px`
                          }}
                        ></div>
                      )}
                    </div>

                    {/* Spin Button */}
                    <div className="text-center mt-8">
                      <button
                        onClick={handleSpinRoulette}
                        disabled={!address || rouletteTotalBet === 0 || isSpinning || Object.keys(rouletteBets).length === 0}
                        className={`px-12 py-4 rounded-2xl font-black text-2xl transition-all duration-300 transform ${
                          isSpinning
                            ? 'bg-gray-600 cursor-not-allowed'
                            : rouletteTotalBet === 0 || Object.keys(rouletteBets).length === 0
                            ? 'bg-gray-600 cursor-not-allowed'
                            : 'bg-gradient-to-r from-yellow-500 via-red-600 to-pink-600 text-white shadow-[0_0_40px_rgba(234,179,8,0.8)] hover:scale-110 hover:shadow-[0_0_60px_rgba(234,179,8,1)] border-4 border-yellow-400'
                        }`}
                      >
                        {isSpinning ? '🎡 SPINNING...' : '🎡 SPIN THE WHEEL'}
                      </button>
                    </div>

                    {/* Result Display */}
                    {rouletteResult && (
                      <div className="mt-6 text-center">
                        <div className={`text-6xl font-black mb-2 ${
                          rouletteResult.number === 0 ? 'text-green-400' :
                          [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(rouletteResult.number)
                            ? 'text-red-400' : 'text-black'
                        }`}>
                          {rouletteResult.number}
                        </div>
                        <div className="text-2xl font-bold text-white">
                          {rouletteResult.color.toUpperCase()} • {rouletteResult.parity}
                        </div>
                        {rouletteResult.winnings > 0 && (
                          <div className="mt-4 text-3xl font-black text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,1)]">
                            🎉 YOU WON {rouletteResult.winnings.toFixed(4)} TOKENS!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Betting Panel */}
              <div className="space-y-4">
                {/* Token Selection */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-yellow-400">
                  <label className="block text-white font-bold mb-2">💰 Token to Bet</label>
                  <select
                    value={rouletteToken}
                    onChange={(e) => setRouletteToken(e.target.value)}
                    className="w-full bg-gray-900 text-white border-2 border-yellow-400 rounded-lg px-4 py-2 font-semibold"
                    disabled={isSpinning}
                  >
                    <option value="">Select token...</option>
                    {userCoins.map((c) => (
                      <option key={c.tokenAddress} value={c.tokenAddress}>
                        {c.symbol} ({parseFloat(c.balance).toFixed(4)}) - {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Outside Bets */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-yellow-400">
                  <h3 className="text-white font-bold mb-4 text-xl">🎯 Outside Bets</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleRouletteBet('red', 0.5)}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg border-2 border-red-400 shadow-lg transition-all hover:scale-105"
                      disabled={isSpinning || !rouletteToken}
                    >
                      RED (1:1)
                    </button>
                    <button
                      onClick={() => handleRouletteBet('black', 0.5)}
                      className="bg-black hover:bg-gray-900 text-white font-bold py-3 px-4 rounded-lg border-2 border-gray-400 shadow-lg transition-all hover:scale-105"
                      disabled={isSpinning || !rouletteToken}
                    >
                      BLACK (1:1)
                    </button>
                    <button
                      onClick={() => handleRouletteBet('even', 0.5)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg border-2 border-blue-400 shadow-lg transition-all hover:scale-105"
                      disabled={isSpinning || !rouletteToken}
                    >
                      EVEN (1:1)
                    </button>
                    <button
                      onClick={() => handleRouletteBet('odd', 0.5)}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg border-2 border-purple-400 shadow-lg transition-all hover:scale-105"
                      disabled={isSpinning || !rouletteToken}
                    >
                      ODD (1:1)
                    </button>
                    <button
                      onClick={() => handleRouletteBet('1-18', 0.5)}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg border-2 border-green-400 shadow-lg transition-all hover:scale-105"
                      disabled={isSpinning || !rouletteToken}
                    >
                      1-18 (1:1)
                    </button>
                    <button
                      onClick={() => handleRouletteBet('19-36', 0.5)}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg border-2 border-orange-400 shadow-lg transition-all hover:scale-105"
                      disabled={isSpinning || !rouletteToken}
                    >
                      19-36 (1:1)
                    </button>
                  </div>
                </div>

                {/* Number Selection */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-yellow-400">
                  <h3 className="text-white font-bold mb-4 text-xl">🎲 Single Numbers (35:1)</h3>
                  <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                    {[...Array(37)].map((_, num) => {
                      const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)
                      const isBlack = num !== 0 && !isRed
                      const betAmount = rouletteBets[`number-${num}`] || 0
                      
                      return (
                        <button
                          key={num}
                          onClick={() => handleRouletteBet(`number-${num}`, 0.1)}
                          className={`font-bold py-2 px-3 rounded-lg border-2 transition-all hover:scale-110 ${
                            num === 0 
                              ? 'bg-green-600 text-white border-green-400' 
                              : isRed 
                              ? 'bg-red-600 text-white border-red-400' 
                              : 'bg-black text-white border-gray-400'
                          } ${betAmount > 0 ? 'ring-4 ring-yellow-400' : ''}`}
                          disabled={isSpinning || !rouletteToken}
                        >
                          <div className="text-xs">{num}</div>
                          {betAmount > 0 && (
                            <div className="text-[10px] text-yellow-300">{betAmount.toFixed(2)}</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Total Bet & Clear */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-yellow-400">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-white font-bold text-xl">Total Bet:</span>
                    <span className="text-yellow-400 font-black text-2xl">{rouletteTotalBet.toFixed(4)}</span>
                  </div>
                  <button
                    onClick={() => {
                      setRouletteBets({})
                      setRouletteTotalBet(0)
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg border-2 border-red-400 transition-all hover:scale-105"
                    disabled={isSpinning}
                  >
                    🗑️ CLEAR ALL BETS
                  </button>
                </div>

                {/* Recent Results */}
                {rouletteHistory.length > 0 && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-yellow-400">
                    <h3 className="text-white font-bold mb-4 text-xl">📜 Recent Results</h3>
                    <div className="flex gap-2 flex-wrap">
                      {rouletteHistory.slice(-10).reverse().map((num, idx) => {
                        const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)
                        const isBlack = num !== 0 && !isRed
                        return (
                          <div
                            key={idx}
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white border-2 ${
                              num === 0 
                                ? 'bg-green-600 border-green-400' 
                                : isRed 
                                ? 'bg-red-600 border-red-400' 
                                : 'bg-black border-gray-400'
                            }`}
                          >
                            {num}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>🎮 All games powered by 0G Network - Decentralized Storage & AI Compute</p>
        </div>
      </div>
    </div>
  )
}
