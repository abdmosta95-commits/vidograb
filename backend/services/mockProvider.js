/**
 * Mock provider for development/demo without external API
 */
export function fetchMock(url, platform) {
  return Promise.resolve({
    title: `Demo Video — ${platform}`,
    author: '@demo_user',
    thumbnail: 'https://picsum.photos/360/640',
    platform,
    formats: [
      {
        label: '1080p MP4',
        quality: '1080p',
        url: '#demo-download',
        size: '12.4 MB',
      },
      {
        label: '720p MP4',
        quality: '720p',
        url: '#demo-download',
        size: '6.8 MB',
      },
      {
        label: 'Audio Only MP3',
        quality: 'audio',
        url: '#demo-download',
        size: '2.1 MB',
      },
    ],
    url: '#demo-download',
    _demo: true,
    _note: 'This is demo data. Enable Cobalt API or yt-dlp for real downloads.',
  });
}
