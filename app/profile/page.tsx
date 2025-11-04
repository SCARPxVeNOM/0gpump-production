'use client'

import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { userProfileManager, UserProfile, TokenCreated } from '../../lib/userProfileManager'
import { 
  User, 
  Edit3, 
  Save, 
  X, 
  Plus, 
  TrendingUp, 
  Coins, 
  Activity,
  Settings,
  Upload,
  Copy,
  ExternalLink,
  Calendar,
  DollarSign
} from 'lucide-react'

export default function ProfilePage() {
  const { address: userAddress, isConnected } = useAccount()
  
  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    username: '',
    bio: '',
    publicProfile: true,
    showTradingStats: true,
    notifications: true
  })
  
  // Avatar upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load profile when wallet is connected
  useEffect(() => {
    if (mounted && isConnected && userAddress) {
      console.log('🔄 Profile page: Wallet connected, loading profile...')
      loadProfile()
    }
  }, [mounted, isConnected, userAddress])

  const loadProfile = async () => {
    if (!userAddress) return

    setIsLoading(true)
    setError(null)

    try {
      const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'

      // Load profile directly from backend API which now returns REAL data
      console.log(`📥 Loading profile from: ${backendBase}/profile/${userAddress}`)
      const profileRes = await fetch(`${backendBase}/profile/${userAddress}`, { cache: 'no-store' })
      
      if (!profileRes.ok) {
        const errorText = await profileRes.text()
        console.error(`❌ Profile API error (${profileRes.status}):`, errorText)
        throw new Error(`Failed to load profile: ${profileRes.statusText}`)
      }

      const data = await profileRes.json()
      console.log('📦 Profile API response:', data)
      
      if (!data.success || !data.profile) {
        console.error('❌ Invalid profile response:', data)
        throw new Error('Invalid profile response from server')
      }

      const completeProfile = data.profile

      // Ensure all fields are present
      const profile = {
        walletAddress: completeProfile.walletAddress || userAddress.toLowerCase(),
        username: completeProfile.username || `User_${userAddress.slice(0, 6)}`,
        bio: completeProfile.bio || 'Welcome to OG Pump! 🚀',
        avatarUrl: completeProfile.avatarUrl || null,
        createdAt: completeProfile.createdAt || new Date().toISOString(),
        updatedAt: completeProfile.updatedAt || new Date().toISOString(),
        tokensCreated: completeProfile.tokensCreated || [],
        tradingStats: {
          totalTrades: completeProfile.tradingStats?.totalTrades || 0,
          totalVolume: completeProfile.tradingStats?.totalVolume || 0,
          tokensHeld: completeProfile.tradingStats?.tokensHeld || 0,
          favoriteTokens: completeProfile.tradingStats?.favoriteTokens || [],
          lastTradeAt: completeProfile.tradingStats?.lastTradeAt || null
        },
        preferences: {
          theme: 'light',
          notifications: true,
          publicProfile: true,
          showTradingStats: true,
          ...completeProfile.preferences
        }
      }
      
      console.log('✅ Profile loaded with REAL data:', {
        tokensCreated: profile.tokensCreated.length,
        totalTrades: profile.tradingStats.totalTrades,
        totalVolume: profile.tradingStats.totalVolume,
        tokensHeld: profile.tradingStats.tokensHeld,
        memberSince: profile.createdAt
      })
      
      setProfile(profile)
      setEditForm({
        username: profile.username,
        bio: profile.bio,
        publicProfile: profile.preferences.publicProfile,
        showTradingStats: profile.preferences.showTradingStats,
        notifications: profile.preferences.notifications
      })
    } catch (error: any) {
      console.error('Error loading profile:', error)
      setError(error.message || 'Failed to load profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!userAddress || !profile) return

    setIsLoading(true)
    setError(null)

    try {
      const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'

      // Handle avatar upload if new file selected
      let avatarUrl = profile.avatarUrl
      let avatarUploadError = null
      
      if (avatarFile) {
        setIsUploadingAvatar(true)
        try {
          const formData = new FormData()
          formData.append('avatar', avatarFile)
          
          const uploadRes = await fetch(`${backendBase}/profile/${userAddress}/avatar`, {
            method: 'POST',
            body: formData
          })
          
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json()
            if (uploadData.success && uploadData.avatarUrl) {
              avatarUrl = uploadData.avatarUrl
              console.log('✅ Avatar uploaded successfully')
            } else {
              avatarUploadError = uploadData.error || 'Failed to upload avatar'
            }
          } else {
            avatarUploadError = `Upload failed: ${uploadRes.statusText}`
          }
        } catch (avatarError: any) {
          avatarUploadError = avatarError.message || 'Avatar upload failed'
          console.warn('⚠️ Avatar upload error:', avatarError)
        }
        setIsUploadingAvatar(false)
      }

      // Update profile via backend API
      const updateRes = await fetch(`${backendBase}/profile/${userAddress}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editForm.username,
          bio: editForm.bio,
          avatarUrl, // Use existing avatar if upload failed
          preferences: {
            ...profile.preferences,
            publicProfile: editForm.publicProfile,
            showTradingStats: editForm.showTradingStats,
            notifications: editForm.notifications
          }
        })
      })

      if (!updateRes.ok) {
        throw new Error(`Failed to update profile: ${updateRes.statusText}`)
      }

      const updateData = await updateRes.json()
      
      if (updateData.success && updateData.profile) {
        setProfile(updateData.profile)
        setIsEditing(false)
        setAvatarFile(null)
        
        // Reload profile to get latest real data
        await loadProfile()
        
        // Show warning if avatar upload failed but profile was saved
        if (avatarUploadError) {
          setError(`Profile saved successfully, but avatar upload failed: ${avatarUploadError}`)
          // Clear the error after 5 seconds
          setTimeout(() => setError(null), 5000)
        }
      } else {
        throw new Error(updateData.error || 'Failed to update profile')
      }
    } catch (error: any) {
      console.error('Error saving profile:', error)
      setError(error.message || 'Failed to save profile')
    } finally {
      setIsLoading(false)
      setIsUploadingAvatar(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setAvatarFile(null)
    if (profile) {
      setEditForm({
        username: profile.username || '',
        bio: profile.bio || '',
        publicProfile: profile.preferences.publicProfile,
        showTradingStats: profile.preferences.showTradingStats,
        notifications: profile.preferences.notifications
      })
    }
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Image size must be less than 5MB')
        return
      }
      setAvatarFile(file)
      setError(null)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
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

  const copyToClipboard = (text: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      // You could add a toast notification here
    }
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
          <p className="text-gray-600">Please connect your wallet to view your profile</p>
        </div>
      </div>
    )
  }

  if (isLoading && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-sky-100 text-slate-900 rounded-2xl p-6 mb-6 border-4 border-black shadow-[6px_6px_0_#000]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {profile?.username?.charAt(0) || 'U'}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {profile?.username || 'User Profile'}
                </h1>
                <p className="text-gray-600">{shortenAddress(userAddress || '')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className="flex items-center space-x-2 px-4 py-2 bg-yellow-300 text-slate-900 border-4 border-black rounded-lg shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSave}
                    disabled={isLoading || isUploadingAvatar}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-400 text-black border-4 border-black rounded-lg shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isLoading || isUploadingAvatar ? 'Saving...' : 'Save'}</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center space-x-2 px-4 py-2 bg-white text-slate-900 border-4 border-black rounded-lg shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-200 border-4 border-black rounded-2xl p-4 mb-6 text-red-900 shadow-[6px_6px_0_#000]">
            <div>{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-sky-100 text-slate-900 rounded-2xl p-6 border-4 border-black shadow-[6px_6px_0_#000]">
              <h2 className="text-lg font-extrabold mb-4">Profile Information</h2>
              
              {isEditing ? (
                <div className="space-y-4">
                  {/* Avatar Upload */}
                  <div>
                    <label className="block text-sm font-extrabold text-slate-900 mb-2">Avatar</label>
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                        {editForm.username.charAt(0) || 'U'}
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="block w-full text-sm text-slate-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-4 file:border-black file:text-sm file:font-extrabold file:bg-white file:text-slate-900 hover:file:translate-x-1 hover:file:translate-y-1 hover:file:shadow-none"
                        />
                        {avatarFile && (
                          <p className="text-sm text-green-600 mt-1">
                            Selected: {avatarFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-sm font-extrabold text-slate-900 mb-2">Username</label>
                    <input
                      type="text"
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black"
                      placeholder="Enter your username"
                    />
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-sm font-extrabold text-slate-900 mb-2">Bio</label>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 rounded-md border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <p className="text-gray-900">{profile?.username || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                    <p className="text-gray-900">{profile?.bio || 'No bio available'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
                    <p className="text-gray-900">{profile ? formatDate(profile.createdAt) : 'Unknown'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tokens Created */}
            <div className="bg-sky-100 text-slate-900 rounded-2xl p-6 border-4 border-black shadow-[6px_6px_0_#000]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold">Tokens Created</h2>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  {profile?.tokensCreated?.length || 0}
                </span>
              </div>
              
              {profile?.tokensCreated?.length ? (
                <div className="space-y-3">
                  {profile.tokensCreated.map((token, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border-4 border-black shadow-[4px_4px_0_#000]">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {token.tokenSymbol.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{token.tokenName}</div>
                          <div className="text-sm text-gray-600">{token.tokenSymbol}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">{formatDate(token.createdAt)}</div>
                        <button
                          onClick={() => copyToClipboard(token.tokenAddress)}
                          className="text-slate-900 bg-yellow-300 border-2 border-black px-2 py-1 rounded shadow-[2px_2px_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none text-sm"
                        >
                          <Copy className="w-4 h-4 inline mr-1" />
                          Copy Address
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Coins className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No tokens created yet</p>
                  <p className="text-sm">Create your first token to get started!</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Trading Stats */}
            {profile?.preferences?.showTradingStats && (
              <div className="bg-sky-100 text-slate-900 rounded-2xl p-6 border-4 border-black shadow-[6px_6px_0_#000]">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Trading Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Trades</span>
                    <span className="font-medium">{profile?.tradingStats?.totalTrades || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Volume</span>
                    <span className="font-medium">{profile?.tradingStats?.totalVolume || 0} OG</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tokens Held</span>
                    <span className="font-medium">{profile?.tradingStats?.tokensHeld || 0}</span>
                  </div>
                  {profile?.tradingStats?.lastTradeAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Trade</span>
                      <span className="font-medium text-sm">{formatDate(profile.tradingStats.lastTradeAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Settings */}
            <div className="bg-sky-100 text-slate-900 rounded-2xl p-6 border-4 border-black shadow-[6px_6px_0_#000]">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Settings
              </h3>
              
              {isEditing ? (
                <div className="space-y-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.publicProfile}
                      onChange={(e) => setEditForm({ ...editForm, publicProfile: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Public Profile</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.showTradingStats}
                      onChange={(e) => setEditForm({ ...editForm, showTradingStats: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Show Trading Stats</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.notifications}
                      onChange={(e) => setEditForm({ ...editForm, notifications: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Notifications</span>
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Public Profile</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      profile?.preferences.publicProfile 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {profile?.preferences.publicProfile ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Show Stats</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      profile?.preferences.showTradingStats 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {profile?.preferences.showTradingStats ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Notifications</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      profile?.preferences.notifications 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {profile?.preferences.notifications ? 'On' : 'Off'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Wallet Info */}
            <div className="bg-sky-100 text-slate-900 rounded-2xl p-6 border-4 border-black shadow-[6px_6px_0_#000]">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Wallet Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-gray-900">{shortenAddress(userAddress || '')}</span>
                    <button
                      onClick={() => copyToClipboard(userAddress || '')}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Copy address"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Network</label>
                  <span className="text-sm text-gray-900">0G Testnet</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
