'use client';

import { useContext } from 'react';
import { AuthContext } from '@/client/features/auth/auth-provider';

export const useAuth = () => useContext(AuthContext);
