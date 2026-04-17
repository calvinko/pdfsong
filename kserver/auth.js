import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      userUuid: user.user_uuid,
      email: user.email
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  );
}

export function createAuthRouter({ pool }) {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const { email, password, displayName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const passwordHash = await bcrypt.hash(password, 12);
      const userUuid = randomUUID();

      await connection.beginTransaction();

      const [userResult] = await connection.execute(
        `
        INSERT INTO users (user_uuid, email, password_hash)
        VALUES (?, ?, ?)
        `,
        [userUuid, normalizedEmail, passwordHash]
      );

      await connection.execute(
        `
        INSERT INTO user_profiles (user_id, display_name, avatar_url, timezone, bio)
        VALUES (?, ?, NULL, NULL, NULL)
        `,
        [userResult.insertId, displayName ?? null]
      );

      await connection.commit();

      const user = {
        id: userResult.insertId,
        user_uuid: userUuid,
        email: normalizedEmail
      };

      const token = signToken(user);

      res.status(201).json({
        token,
        user: {
          userUuid: user.user_uuid,
          email: user.email
        }
      });
    } catch (error) {
      await connection.rollback();
      console.error('Register failed:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Email already registered' });
      }

      res.status(500).json({ error: 'Server error' });
    } finally {
      connection.release();
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const [rows] = await pool.execute(
        `
        SELECT id, user_uuid, email, password_hash
        FROM users
        WHERE email = ?
        LIMIT 1
        `,
        [normalizedEmail]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);

      if (!ok) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = signToken(user);

      res.json({
        token,
        user: {
          userUuid: user.user_uuid,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Login failed:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}
