import { ReveAI, ReveAIError } from '../index';
import axios from 'axios';

// Mock the specific dependencies instead of the entire axios module
jest.mock('axios', () => {
  const mockPost = jest.fn();
  const mockGet = jest.fn();
  
  return {
    create: jest.fn(() => ({
      post: mockPost,
      get: mockGet,
      interceptors: {
        request: {
          use: jest.fn((requestFn) => requestFn),
        },
        response: {
          use: jest.fn((responseFn, _) => responseFn),
        },
      },
    })),
    defaults: {
      headers: { common: {} },
    },
  };
});

// Mock axios-retry
jest.mock('axios-retry', () => ({
  __esModule: true,
  default: jest.fn(),
  isNetworkOrIdempotentRequestError: jest.fn(() => true),
  exponentialDelay: jest.fn(() => 100),
}));

// Mock Buffer for base64 encoding in tests
global.Buffer = {
  from: jest.fn(() => ({
    toString: jest.fn(() => 'mock-base64-data')
  }))
} as unknown as typeof Buffer;

describe('ReveAI SDK', () => {
  let reveAI: ReveAI;
  let mockPost: jest.Mock;
  let mockGet: jest.Mock;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get fresh instances of the mocks from axios.create
    const mockedCreate = axios.create as jest.Mock;
    const mockAxiosInstance = mockedCreate();
    mockPost = mockAxiosInstance.post;
    mockGet = mockAxiosInstance.get;
    
    reveAI = new ReveAI({
      auth: {
        authorization: 'Bearer mock-token',
        cookie: 'mock-cookie=value',
      },
      projectId: 'mock-project-id', // Always provide project ID in tests
    });
  });
  
  describe('constructor', () => {
    it('should create an instance with default options', () => {
      expect(reveAI).toBeInstanceOf(ReveAI);
      expect(axios.create).toHaveBeenCalled();
    });
    
    it('should throw if auth options are missing', () => {
      // @ts-expect-error Testing that missing auth options causes an error
      expect(() => new ReveAI({})).toThrow(ReveAIError);
    });
    
    it('should accept custom options', () => {
      const customReveAI = new ReveAI({
        auth: {
          authorization: 'Bearer mock-token',
          cookie: 'mock-cookie=value',
        },
        baseUrl: 'https://custom.reve.art',
        timeout: 30000,
        pollingInterval: 1000,
        projectId: 'custom-project-id',
      });
      
      expect(customReveAI).toBeInstanceOf(ReveAI);
      expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
        baseURL: 'https://custom.reve.art',
        timeout: 30000,
      }));
    });
  });
  
  describe('generateImage', () => {
    beforeEach(() => {
      // Mock successful generation request
      mockPost.mockImplementation((url: string) => {
        if (url === '/api/project/mock-project-id/generation') {
          return Promise.resolve({
            data: {
              create: {
                node: {
                  id: 'mock-gen-id-123' 
                }
              }
            },
          });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Mock successful node list with completed generation
      mockGet.mockImplementation((url: string) => {
        if (url === '/api/project/mock-project-id/node') {
          return Promise.resolve({
            data: {
              list: [{
                node: {
                  id: 'mock-gen-id-123',
                  type: 'generation'
                },
                data: {
                  output: 'mock-image-id-456',
                  inference_inputs: {
                    seed: 12345,
                    caption: 'test prompt',
                    negative_caption: '',
                    width: 1024,
                    height: 1024
                  }
                }
              }]
            }
          });
        }
        
        // Mock successful image content response
        if (url === '/api/project/mock-project-id/image/mock-image-id-456/url') {
          return Promise.resolve({
            data: new ArrayBuffer(8), // Mock image data
            headers: {
              'content-type': 'image/webp'
            }
          });
        }
        
        return Promise.resolve({ data: {} });
      });
    });
    
    it('should generate images with default parameters', async () => {
      const result = await reveAI.generateImage({
        prompt: 'test prompt',
      });
      
      // Check that the proper generation payload was sent
      expect(mockPost).toHaveBeenCalledWith(
        '/api/project/mock-project-id/generation', 
        expect.objectContaining({
          data: expect.objectContaining({
            inference_inputs: expect.objectContaining({
              caption: 'test prompt',
              width: 1024,
              height: 1024,
            })
          })
        })
      );
      
      // Check the result format
      expect(result).toHaveProperty('imageUrls');
      expect(result.imageUrls).toHaveLength(1);
      expect(result.imageUrls[0]).toContain('data:image/webp;base64,mock-base64-data');
      expect(result.seed).toBe(12345);
      expect(result.prompt).toBe('test prompt');
    });
    
    it('should use custom parameters when provided', async () => {
      await reveAI.generateImage({
        prompt: 'test prompt',
        negativePrompt: 'negative test',
        width: 512,
        height: 768,
        batchSize: 2,
        seed: 42,
        model: 'custom-model',
        enhancePrompt: false,
      });
      
      // Check that the proper generation payloads were sent
      expect(mockPost).toHaveBeenCalledTimes(2);
      
      // Check both calls have the correct base parameters
      mockPost.mock.calls.forEach(call => {
        expect(call[0]).toBe('/api/project/mock-project-id/generation');
        expect(call[1]).toEqual(
          expect.objectContaining({
            data: expect.objectContaining({
              client_metadata: expect.objectContaining({
                aspectRatio: '512:768',
                instruction: 'test prompt',
                optimizeEnabled: false,
                unexpandedPrompt: 'test prompt'
              }),
              inference_inputs: expect.objectContaining({
                caption: 'test prompt',
                negative_caption: 'negative test',
                width: 512,
                height: 768
              }),
              inference_model: 'custom-model'
            })
          })
        );
      });
      
      // Verify that the seeds are different but based on the provided seed
      const seeds = mockPost.mock.calls.map(call => call[1].data.inference_inputs.seed);
      expect(seeds[0]).not.toBe(seeds[1]); // Seeds should be different
      expect(seeds[0]).toBeGreaterThanOrEqual(42); // Should be based on provided seed
      expect(seeds[1]).toBeGreaterThanOrEqual(42); // Should be based on provided seed
    });
    
    it('should use default enhancePrompt value when not provided', async () => {
      await reveAI.generateImage({
        prompt: 'test prompt',
      });
      
      // Check that the proper generation payload was sent
      expect(mockPost).toHaveBeenCalledWith(
        '/api/project/mock-project-id/generation',
        expect.objectContaining({
          data: expect.objectContaining({
            client_metadata: expect.objectContaining({
              optimizeEnabled: true,
            }),
          }),
        })
      );
    });
    
    it('should throw an error for invalid parameters', async () => {
      await expect(reveAI.generateImage({
        prompt: 'test prompt',
        width: 100, // Too small
      })).rejects.toThrow(ReveAIError);
      
      await expect(reveAI.generateImage({
        prompt: 'test prompt',
        batchSize: 10, // Too large
      })).rejects.toThrow(ReveAIError);
    });
    
    it('should handle generation failure', async () => {
      // Mock failed generation
      mockGet.mockImplementation((url: string) => {
        if (url === '/api/project/mock-project-id/node') {
          return Promise.resolve({
            data: {
              list: [{
                node: {
                  id: 'mock-gen-id-123',
                  type: 'generation'
                },
                data: {
                  error: 'Generation failed',
                  inference_inputs: {
                    seed: 12345
                  }
                }
              }]
            }
          });
        }
        return Promise.resolve({ data: {} });
      });
      
      await expect(reveAI.generateImage({
        prompt: 'test prompt',
      })).rejects.toThrow(/Generation failed/);
    });
    
    it('should timeout if generation takes too long', async () => {
      // Mock a node response without output (still processing)
      mockGet.mockImplementation((url: string) => {
        if (url === '/api/project/mock-project-id/node') {
          return Promise.resolve({
            data: {
              list: [{
                node: {
                  id: 'mock-gen-id-123',
                  type: 'generation'
                },
                data: {
                  // No output field - still processing
                  inference_inputs: {
                    seed: 12345
                  }
                }
              }]
            }
          });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Create instance with small polling attempts
      const timeoutReveAI = new ReveAI({
        auth: {
          authorization: 'Bearer mock-token',
          cookie: 'mock-cookie=value',
        },
        projectId: 'mock-project-id',
        maxPollingAttempts: 1, // Only try once
        pollingInterval: 1, // Very short interval for tests
      });
      
      await expect(timeoutReveAI.generateImage({
        prompt: 'test prompt',
      })).rejects.toThrow(/Generation timed out/);
    });
  });
}); 