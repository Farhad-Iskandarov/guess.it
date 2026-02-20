import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  User, Camera, Mail, Lock, Edit3, Loader2, Check, X, AlertTriangle,
  Eye, EyeOff, Shield, Upload, Trash2, Info, ChevronLeft, Bell, Volume2, VolumeX, Globe
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ============ Section Card ============
const SectionCard = memo(({ icon: Icon, title, description, children }) => (
  <div 
    className="bg-card rounded-xl border border-border/50 p-6 animate-fade-in"
    data-testid={`section-${title.toLowerCase().replace(/\s/g, '-')}`}
  >
    <div className="flex items-start gap-3 mb-5">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
    {children}
  </div>
));
SectionCard.displayName = 'SectionCard';

// ============ Toggle Row ============
const ToggleRow = memo(({ icon: Icon, iconColor, title, description, checked, onChange, loading, testId }) => (
  <div className="flex items-center justify-between py-3" data-testid={testId}>
    <div className="flex items-start gap-3">
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${iconColor || 'bg-primary/10'} flex-shrink-0 mt-0.5`}>
        <Icon className="w-4 h-4 text-current" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
    <button
      onClick={onChange}
      disabled={loading}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      }`}
      data-testid={`${testId}-toggle`}
      aria-label={`Toggle ${title}`}
    >
      <span className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
        checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
      }`} />
    </button>
  </div>
));
ToggleRow.displayName = 'ToggleRow';

// ============ Privacy & Notifications Section ============
const PrivacyNotificationsSection = memo(() => {
  const [onlineVisibility, setOnlineVisibility] = useState(true);
  const [notificationSound, setNotificationSound] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [deliveryStatus, setDeliveryStatus] = useState(true);
  const [loadingVisibility, setLoadingVisibility] = useState(false);
  const [loadingSound, setLoadingSound] = useState(false);
  const [loadingReadReceipts, setLoadingReadReceipts] = useState(false);
  const [loadingDeliveryStatus, setLoadingDeliveryStatus] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch(`${API_URL}/api/settings/preferences`, { credentials: 'include' });
        if (resp.ok) {
          const data = await resp.json();
          setOnlineVisibility(data.data?.online_visibility ?? true);
          setNotificationSound(data.data?.notification_sound ?? true);
          setReadReceipts(data.data?.read_receipts_enabled ?? true);
          setDeliveryStatus(data.data?.delivery_status_enabled ?? true);
        }
      } catch {}
    };
    load();
  }, []);

  const toggleVisibility = useCallback(async () => {
    setLoadingVisibility(true);
    const newVal = !onlineVisibility;
    try {
      const resp = await fetch(`${API_URL}/api/settings/online-visibility`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: newVal })
      });
      if (resp.ok) {
        setOnlineVisibility(newVal);
        toast.success(newVal ? 'Online status visible to friends' : 'Online status hidden from friends');
      }
    } catch {
      toast.error('Failed to update visibility');
    } finally {
      setLoadingVisibility(false);
    }
  }, [onlineVisibility]);

  const toggleSound = useCallback(async () => {
    setLoadingSound(true);
    const newVal = !notificationSound;
    try {
      const resp = await fetch(`${API_URL}/api/settings/notification-sound`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newVal })
      });
      if (resp.ok) {
        setNotificationSound(newVal);
        toast.success(newVal ? 'Notification sounds enabled' : 'Notification sounds muted');
      }
    } catch {
      toast.error('Failed to update sound setting');
    } finally {
      setLoadingSound(false);
    }
  }, [notificationSound]);

  const toggleReadReceipts = useCallback(async () => {
    setLoadingReadReceipts(true);
    const newVal = !readReceipts;
    try {
      const resp = await fetch(`${API_URL}/api/settings/read-receipts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newVal })
      });
      if (resp.ok) {
        setReadReceipts(newVal);
        toast.success(newVal ? 'Read receipts enabled' : 'Read receipts disabled');
      }
    } catch {
      toast.error('Failed to update read receipts');
    } finally {
      setLoadingReadReceipts(false);
    }
  }, [readReceipts]);

  const toggleDeliveryStatus = useCallback(async () => {
    setLoadingDeliveryStatus(true);
    const newVal = !deliveryStatus;
    try {
      const resp = await fetch(`${API_URL}/api/settings/delivery-status`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newVal })
      });
      if (resp.ok) {
        setDeliveryStatus(newVal);
        toast.success(newVal ? 'Delivery status enabled' : 'Delivery status disabled');
      }
    } catch {
      toast.error('Failed to update delivery status');
    } finally {
      setLoadingDeliveryStatus(false);
    }
  }, [deliveryStatus]);

  return (
    <SectionCard icon={Bell} title="Privacy & Notifications" description="Control your visibility and notification preferences">
      <div className="space-y-1 divide-y divide-border/30">
        <ToggleRow
          icon={Globe}
          iconColor="bg-emerald-500/10 text-emerald-500"
          title="Online Visibility"
          description="Show your online status to friends"
          checked={onlineVisibility}
          onChange={toggleVisibility}
          loading={loadingVisibility}
          testId="online-visibility"
        />
        <ToggleRow
          icon={notificationSound ? Volume2 : VolumeX}
          iconColor="bg-blue-500/10 text-blue-500"
          title="Notification Sounds"
          description="Play sounds for messages and alerts"
          checked={notificationSound}
          onChange={toggleSound}
          loading={loadingSound}
          testId="notification-sound"
        />
        <ToggleRow
          icon={Eye}
          iconColor="bg-violet-500/10 text-violet-500"
          title="Read Receipts"
          description="Allow others to see when you've read their messages"
          checked={readReceipts}
          onChange={toggleReadReceipts}
          loading={loadingReadReceipts}
          testId="read-receipts"
        />
        <ToggleRow
          icon={Check}
          iconColor="bg-amber-500/10 text-amber-500"
          title="Delivery Status"
          description="Allow others to see when messages are delivered to you"
          checked={deliveryStatus}
          onChange={toggleDeliveryStatus}
          loading={loadingDeliveryStatus}
          testId="delivery-status"
        />
      </div>
    </SectionCard>
  );
});
PrivacyNotificationsSection.displayName = 'PrivacyNotificationsSection';

// ============ Password Input ============
const PasswordInput = memo(({ id, label, value, onChange, placeholder, error, disabled }) => {
  const [show, setShow] = useState(false);
  
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-10 ${error ? 'border-destructive' : ''}`}
          data-testid={id}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';

// ============ Loading Skeleton ============
const SettingsSkeleton = () => (
  <div className="space-y-6 animate-pulse" data-testid="settings-skeleton">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="bg-card rounded-xl border border-border/50 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-3 w-48 bg-muted rounded" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-10 w-full bg-muted rounded" />
          <div className="h-10 w-32 bg-muted rounded" />
        </div>
      </div>
    ))}
  </div>
);

// ============ Main Settings Page ============
export const SettingsPage = () => {
  const { user, isAuthenticated, isLoading: authLoading, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Settings state
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Avatar upload state
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState({});
  const [changingPassword, setChangingPassword] = useState(false);

  // Nickname change state
  const [newNickname, setNewNickname] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [changingNickname, setChangingNickname] = useState(false);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/settings/profile`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data.data);
        setNewEmail(data.data.email || '');
        setNewNickname(data.data.nickname || '');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchSettings();
    } else if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, fetchSettings, navigate]);

  // ========== Avatar Handlers ==========
  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a JPG, PNG, or WebP image');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2MB');
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', avatarFile);

      const response = await fetch(`${API_URL}/api/settings/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to upload avatar');
      }

      toast.success('Profile picture updated');
      setAvatarFile(null);
      setAvatarPreview(null);
      await refreshUser();
      await fetchSettings();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    setUploadingAvatar(true);
    try {
      const response = await fetch(`${API_URL}/api/settings/avatar`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to remove avatar');
      }

      toast.success('Profile picture removed');
      setAvatarPreview(null);
      setAvatarFile(null);
      await refreshUser();
      await fetchSettings();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const cancelAvatarPreview = () => {
    setAvatarPreview(null);
    setAvatarFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ========== Email Handlers ==========
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = async (e) => {
    e.preventDefault();
    setEmailError('');

    if (!validateEmail(newEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (newEmail.toLowerCase() === settings?.email?.toLowerCase()) {
      setEmailError('New email is the same as current email');
      return;
    }

    if (!emailPassword) {
      setEmailError('Please enter your current password');
      return;
    }

    setChangingEmail(true);
    try {
      const response = await fetch(`${API_URL}/api/settings/email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_email: newEmail,
          current_password: emailPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to change email');
      }

      toast.success('Email updated successfully');
      setEmailPassword('');
      await refreshUser();
      await fetchSettings();
    } catch (error) {
      setEmailError(error.message);
    } finally {
      setChangingEmail(false);
    }
  };

  // ========== Password Handlers ==========
  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (!/\d/.test(password)) errors.push('One digit');
    return errors;
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordErrors({});

    const newPasswordErrors = validatePassword(newPassword);
    if (newPasswordErrors.length > 0) {
      setPasswordErrors({ newPassword: `Password must contain: ${newPasswordErrors.join(', ')}` });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    if (!currentPassword) {
      setPasswordErrors({ currentPassword: 'Please enter your current password' });
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch(`${API_URL}/api/settings/password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to change password');
      }

      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordErrors({ currentPassword: error.message });
    } finally {
      setChangingPassword(false);
    }
  };

  // ========== Nickname Handlers ==========
  const handleNicknameChange = async (e) => {
    e.preventDefault();
    setNicknameError('');

    // Validate nickname format
    if (newNickname.length < 3 || newNickname.length > 20) {
      setNicknameError('Nickname must be 3-20 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newNickname)) {
      setNicknameError('Only letters, numbers, and underscores allowed');
      return;
    }

    if (newNickname.toLowerCase() === settings?.nickname?.toLowerCase()) {
      setNicknameError('New nickname is the same as current nickname');
      return;
    }

    setChangingNickname(true);
    try {
      const response = await fetch(`${API_URL}/api/settings/nickname`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_nickname: newNickname })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to change nickname');
      }

      toast.success('Nickname updated! This was your one-time change.');
      await refreshUser();
      await fetchSettings();
    } catch (error) {
      setNicknameError(error.message);
    } finally {
      setChangingNickname(false);
    }
  };

  // ========== Logout Handler ==========
  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  // Display values
  const displayName = user?.nickname || user?.name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const currentPicture = avatarPreview || settings?.picture || user?.picture;
  const isGoogleUser = settings?.is_google_user || user?.auth_provider === 'google';
  const canChangeNickname = settings?.can_change_nickname ?? false;
  const nicknameChanged = settings?.nickname_changed ?? false;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background" data-testid="settings-page">
        <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />
        <main className="container mx-auto px-4 md:px-6 py-8 max-w-2xl">
          <SettingsSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="settings-page">
      <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />
      
      <main className="container mx-auto px-4 md:px-6 py-8 max-w-2xl">
        {/* Back button & Title */}
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/profile')}
            className="rounded-full"
            data-testid="back-to-profile"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        </div>

        <div className="space-y-6">
          {/* ===== Profile Picture Section ===== */}
          <SectionCard
            icon={Camera}
            title="Profile Picture"
            description="Upload a photo to personalize your profile"
          >
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar preview */}
              <div className="relative group">
                <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                  <AvatarImage src={currentPicture} alt={displayName} />
                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-2xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {avatarPreview && (
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                  data-testid="avatar-input"
                />

                {avatarPreview ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleAvatarUpload}
                      disabled={uploadingAvatar}
                      className="gap-2"
                      data-testid="save-avatar-btn"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Save Photo
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelAvatarPreview}
                      disabled={uploadingAvatar}
                      data-testid="cancel-avatar-btn"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="gap-2"
                      data-testid="upload-avatar-btn"
                    >
                      <Camera className="w-4 h-4" />
                      {currentPicture ? 'Change Photo' : 'Upload Photo'}
                    </Button>
                    {currentPicture && !isGoogleUser && (
                      <Button
                        variant="ghost"
                        onClick={handleAvatarRemove}
                        disabled={uploadingAvatar}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        data-testid="remove-avatar-btn"
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, or WebP. Max 2MB.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* ===== Account Information Section ===== */}
          <SectionCard
            icon={User}
            title="Account Information"
            description="Manage your email and nickname"
          >
            <div className="space-y-6">
              {/* Email Change */}
              {!isGoogleUser ? (
                <form onSubmit={handleEmailChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="your@email.com"
                      disabled={changingEmail}
                      className={emailError ? 'border-destructive' : ''}
                      data-testid="email-input"
                    />
                  </div>

                  <PasswordInput
                    id="email-password"
                    label="Confirm with Password"
                    value={emailPassword}
                    onChange={setEmailPassword}
                    placeholder="Enter current password"
                    disabled={changingEmail}
                  />

                  {emailError && (
                    <p className="text-sm text-destructive flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {emailError}
                    </p>
                  )}

                  <Button 
                    type="submit" 
                    disabled={changingEmail || newEmail === settings?.email}
                    className="gap-2"
                    data-testid="save-email-btn"
                  >
                    {changingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
                    Update Email
                  </Button>
                </form>
              ) : (
                <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="w-4 h-4" />
                    <span>Email is managed by Google ({settings?.email})</span>
                  </div>
                </div>
              )}

              <Separator />

              {/* Nickname Change */}
              <form onSubmit={handleNicknameChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nickname" className="text-sm font-medium flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-muted-foreground" />
                    Nickname
                    {nicknameChanged && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Changed
                      </span>
                    )}
                  </Label>
                  <Input
                    id="nickname"
                    type="text"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    placeholder="YourNickname"
                    disabled={changingNickname || !canChangeNickname}
                    className={nicknameError ? 'border-destructive' : ''}
                    data-testid="nickname-input"
                  />
                </div>

                {canChangeNickname && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-500 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>You can only change your nickname <strong>once</strong>. Choose wisely!</span>
                    </p>
                  </div>
                )}

                {nicknameChanged && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Info className="w-4 h-4 flex-shrink-0" />
                      <span>You have already used your one-time nickname change.</span>
                    </p>
                  </div>
                )}

                {nicknameError && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {nicknameError}
                  </p>
                )}

                {canChangeNickname && (
                  <Button 
                    type="submit" 
                    disabled={changingNickname || newNickname === settings?.nickname}
                    className="gap-2"
                    data-testid="save-nickname-btn"
                  >
                    {changingNickname && <Loader2 className="w-4 h-4 animate-spin" />}
                    Change Nickname
                  </Button>
                )}
              </form>
            </div>
          </SectionCard>

          {/* ===== Security Section ===== */}
          {!isGoogleUser && (
            <SectionCard
              icon={Shield}
              title="Security"
              description="Update your password"
            >
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <PasswordInput
                  id="current-password"
                  label="Current Password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Enter current password"
                  error={passwordErrors.currentPassword}
                  disabled={changingPassword}
                />

                <PasswordInput
                  id="new-password"
                  label="New Password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Enter new password"
                  error={passwordErrors.newPassword}
                  disabled={changingPassword}
                />

                <PasswordInput
                  id="confirm-password"
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm new password"
                  error={passwordErrors.confirmPassword}
                  disabled={changingPassword}
                />

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Password requirements:</p>
                  <ul className="list-disc list-inside ml-2">
                    <li>At least 8 characters</li>
                    <li>One uppercase letter</li>
                    <li>One lowercase letter</li>
                    <li>One digit</li>
                  </ul>
                </div>

                <Button 
                  type="submit" 
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="gap-2"
                  data-testid="save-password-btn"
                >
                  {changingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Lock className="w-4 h-4" />
                  Update Password
                </Button>
              </form>
            </SectionCard>
          )}

          {/* Google User Security Notice */}
          {isGoogleUser && (
            <SectionCard
              icon={Shield}
              title="Security"
              description="Your account security settings"
            >
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Secured by Google</p>
                    <p className="text-xs text-muted-foreground">
                      Password is managed through your Google account
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ============ Privacy & Notifications Section ============ */}
          <PrivacyNotificationsSection />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SettingsPage;
