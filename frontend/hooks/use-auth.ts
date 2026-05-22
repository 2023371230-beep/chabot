'use client';

import { useContext } from 'react';
import { AuthContext } from '@/features/auth/auth-provider';

export const useAuth = () => useContext(AuthContext);
