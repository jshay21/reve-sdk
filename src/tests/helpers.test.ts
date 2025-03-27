import { delay, handleAxiosError, generateRandomSeed, validateImageOptions, parseJwt } from '../utils/helpers';
import { ReveAIError, ReveAIErrorType } from '../types';
import { AxiosError } from 'axios';

describe('Helper Functions', () => {
  describe('delay', () => {
    it('should delay execution for the specified time', async () => {
      const start = Date.now();
      
      await delay(100);
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allowing for small timing variations
    });
  });
  
  describe('handleAxiosError', () => {
    it('should convert authentication errors', () => {
      const axiosError = new Error('Unauthorized') as AxiosError;
      axiosError.isAxiosError = true;
      Object.defineProperty(axiosError, 'response', {
        value: {
          status: 401,
          data: { message: 'Invalid credentials' }
        }
      });
      
      const result = handleAxiosError(axiosError, 'login');
      
      expect(result).toBeInstanceOf(ReveAIError);
      expect(result.type).toBe(ReveAIErrorType.AUTHENTICATION_ERROR);
      expect(result.message).toContain('Invalid credentials');
    });
    
    it('should convert timeout errors', () => {
      const axiosError = new Error('Timeout of 30000ms exceeded') as AxiosError;
      axiosError.isAxiosError = true;
      axiosError.code = 'ECONNABORTED';
      
      const result = handleAxiosError(axiosError, 'generating image');
      
      expect(result).toBeInstanceOf(ReveAIError);
      expect(result.type).toBe(ReveAIErrorType.TIMEOUT_ERROR);
    });
    
    it('should convert API errors', () => {
      const axiosError = new Error('Bad Request') as AxiosError;
      axiosError.isAxiosError = true;
      Object.defineProperty(axiosError, 'response', {
        value: {
          status: 400,
          data: { message: 'Invalid prompt' }
        }
      });
      
      const result = handleAxiosError(axiosError, 'generating image');
      
      expect(result).toBeInstanceOf(ReveAIError);
      expect(result.type).toBe(ReveAIErrorType.API_ERROR);
      expect(result.statusCode).toBe(400);
    });
    
    it('should pass through ReveAIError instances', () => {
      const originalError = new ReveAIError('Original error', ReveAIErrorType.GENERATION_ERROR);
      const result = handleAxiosError(originalError, 'operation');
      
      expect(result).toBe(originalError);
    });
    
    it('should handle non-Axios errors', () => {
      const error = new Error('Random error');
      const result = handleAxiosError(error, 'operation');
      
      expect(result).toBeInstanceOf(ReveAIError);
      expect(result.type).toBe(ReveAIErrorType.UNKNOWN_ERROR);
    });
  });
  
  describe('generateRandomSeed', () => {
    it('should generate a number within valid range', () => {
      const seed = generateRandomSeed();
      
      expect(typeof seed).toBe('number');
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(2147483647);
    });
    
    it('should generate different seeds on subsequent calls', () => {
      const seed1 = generateRandomSeed();
      const seed2 = generateRandomSeed();
      
      // There's a tiny chance this could fail randomly
      expect(seed1).not.toBe(seed2);
    });
  });
  
  describe('validateImageOptions', () => {
    it('should not throw for valid options', () => {
      expect(() => validateImageOptions(512, 512, 2)).not.toThrow();
    });
    
    it('should throw for invalid width', () => {
      expect(() => validateImageOptions(100, 512)).toThrow(ReveAIError);
      expect(() => validateImageOptions(1025, 512)).toThrow(ReveAIError);
      expect(() => validateImageOptions(513, 512)).toThrow(ReveAIError);
    });
    
    it('should throw for invalid height', () => {
      expect(() => validateImageOptions(512, 100)).toThrow(ReveAIError);
      expect(() => validateImageOptions(512, 1025)).toThrow(ReveAIError);
      expect(() => validateImageOptions(512, 513)).toThrow(ReveAIError);
    });
    
    it('should throw for invalid batch size', () => {
      expect(() => validateImageOptions(512, 512, 0)).toThrow(ReveAIError);
      expect(() => validateImageOptions(512, 512, 9)).toThrow(ReveAIError);
    });
  });
  
  describe('parseJwt', () => {
    it('should parse a valid JWT token', () => {
      // This is a test JWT with payload: { "sub": "1234", "name": "Test User", "iat": 1516239022 }
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0IiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      // Mock atob for Node.js environment
      global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('binary'));
      
      const result = parseJwt(token);
      
      expect(result).toEqual({
        sub: '1234',
        name: 'Test User',
        iat: 1516239022
      });
    });
    
    it('should return empty object for invalid token', () => {
      const result = parseJwt('invalid-token');
      expect(result).toEqual({});
    });
  });
}); 