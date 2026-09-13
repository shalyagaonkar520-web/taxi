import React, { useEffect, useState } from 'react';
import { Camera, Check, UserRound, X } from 'lucide-react';
import { updateUserProfile } from '../services/api';

export default function ProfileModal({ user, onClose, onProfileUpdate }) {
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', avatar: '' });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      avatar: user?.avatar || ''
    });
  }, [user]);

  const updateField = (field, value) => setProfile((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus('');
    try {
      const updated = await updateUserProfile(user.id, profile);
      onProfileUpdate(updated);
      setStatus('Profile saved');
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
            <label className="text-xs font-semibold text-gray-400" htmlFor="avatar">Photo URL</label>
            <input id="avatar" value={profile.avatar} onChange={(event) => updateField('avatar', event.target.value)} placeholder="https://..." className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs outline-none focus:border-uber-accent" />
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

        {status && <p className="mt-4 text-xs text-gray-300 flex items-center gap-1"><Check className="w-3.5 h-3.5 text-uber-green" /> {status}</p>}
        <button type="submit" disabled={saving} className="mt-5 w-full rounded-xl bg-uber-accent px-4 py-3 font-bold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save profile'}</button>
      </form>
    </div>
  );
}
