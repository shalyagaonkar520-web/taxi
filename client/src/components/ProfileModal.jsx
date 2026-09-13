import React, { useEffect, useState } from 'react';
import { Camera, Check, Eye, EyeOff, KeyRound, UserRound, X } from 'lucide-react';
import { changeUserPassword, updateUserProfile } from '../services/api';
import { changeFirebasePassword, firebaseEnabled } from '../services/firebaseAuth';

export default function ProfileModal({ user, onClose, onProfileUpdate }) {
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', avatar: '' });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      avatar: user?.avatar || ''
    });
  }, [user]);

  const updateField = (field, value) => setProfile((current) => ({ ...current, [field]: value }));

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('Choose an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateField('avatar', reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus('');
    try {
      const updated = await updateUserProfile(user.id, profile);
      if (newPassword || currentPassword || confirmPassword) {
        if (newPassword !== confirmPassword) throw new Error('New passwords do not match');
        if (firebaseEnabled) {
          try {
            await changeFirebasePassword(newPassword);
          } catch (firebaseError) {
            if (!firebaseError.message.includes('No Firebase account')) throw firebaseError;
            await changeUserPassword(user.id, currentPassword, newPassword);
          }
        } else {
          await changeUserPassword(user.id, currentPassword, newPassword);
        }
      }
      onProfileUpdate(updated);
      setStatus('Profile saved');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setStatus(error.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-card w-full max-w-md rounded-3xl border border-white/15 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-uber-accent/20 text-uber-accent flex items-center justify-center"><UserRound className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg font-extrabold">Your profile</h2>
              <p className="text-xs text-gray-400">Keep your contact details up to date.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close profile" className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div className="relative">
            {profile.avatar ? <img src={profile.avatar} alt="Profile" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/10" /> : <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center"><UserRound className="w-7 h-7 text-gray-400" /></div>}
            <Camera className="absolute -right-2 -bottom-2 w-6 h-6 rounded-lg bg-uber-accent p-1.5 text-white" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-400" htmlFor="avatar-file">Profile photo</label>
            <input id="avatar-file" type="file" accept="image/*" onChange={handlePhoto} className="mt-1 block w-full text-[11px] text-gray-400 file:mr-2 file:rounded-lg file:border-0 file:bg-uber-accent/20 file:px-2 file:py-1.5 file:text-[11px] file:font-semibold file:text-uber-accent" />
          </div>
        </div>

        <div className="grid gap-4">
          {[['name', 'Full name', 'text'], ['email', 'Email address', 'email'], ['phone', 'Phone number', 'tel']].map(([field, label, type]) => (
            <label key={field} className="text-xs font-semibold text-gray-400" htmlFor={field}>
              {label}
              <input id={field} type={type} required={field !== 'phone'} value={profile[field]} onChange={(event) => updateField(field, event.target.value)} className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-sm text-white outline-none focus:border-uber-accent" />
            </label>
          ))}
        </div>

        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="flex items-center justify-between mb-3">
            <div><p className="text-sm font-bold text-white">Change password</p><p className="text-[11px] text-gray-500">Use at least 8 characters.</p></div>
            <KeyRound className="w-4 h-4 text-gray-500" />
          </div>
          {[['current-password', 'Current password', currentPassword, setCurrentPassword], ['new-password', 'New password', newPassword, setNewPassword], ['confirm-password', 'Confirm new password', confirmPassword, setConfirmPassword]].map(([id, label, value, setter]) => (
            <label key={id} className="relative block text-xs font-semibold text-gray-400 mb-3" htmlFor={id}>{label}
              <input id={id} type={showPasswords ? 'text' : 'password'} minLength="8" value={value} onChange={(event) => setter(event.target.value)} className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 pr-10 text-sm text-white outline-none focus:border-uber-accent" />
            </label>
          ))}
          <button type="button" onClick={() => setShowPasswords((visible) => !visible)} className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1"><Eye className="w-3 h-3" /> {showPasswords ? 'Hide passwords' : 'Show passwords'}</button>
        </div>

        {status && <p className="mt-4 text-xs text-gray-300 flex items-center gap-1"><Check className="w-3.5 h-3.5 text-uber-green" /> {status}</p>}
        <button type="submit" disabled={saving} className="mt-5 w-full rounded-xl bg-uber-accent px-4 py-3 font-bold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save profile'}</button>
      </form>
    </div>
  );
}
