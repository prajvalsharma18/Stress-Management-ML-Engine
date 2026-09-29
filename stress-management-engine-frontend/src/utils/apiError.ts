import axios from 'axios'

export function getApiErrorMessage(error: unknown, fallback = 'Unable to complete the request. Please try again.') {
  if (!axios.isAxiosError(error)) return fallback
  if (!error.response) return 'Unable to connect to SURAKSHAI. Check your connection and try again.'
  switch (error.response.status) {
    case 400: return 'The submitted information is not valid.'
    case 401: return 'Your session is no longer valid. Please sign in again.'
    case 403: return 'Your role is not authorised to access this information.'
    case 404: return 'The requested information was not found.'
    case 409: return 'This request conflicts with the current record state.'
    case 413: return 'The submitted information is too large. Reduce its size and try again.'
    case 422: return 'The submitted information could not be processed.'
    case 429: return 'Too many requests were submitted. Wait a moment and try again.'
    case 503: return 'The service is temporarily unavailable. Please try again later.'
    default: return fallback
  }
}
