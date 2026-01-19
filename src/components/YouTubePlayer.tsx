import React, { useEffect, useRef } from 'react';

interface YouTubePlayerProps {
    videoId: string;
    command?: { action: string; timestamp: number } | null;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, command }) => {
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize Player
    useEffect(() => {
        // Load YouTube API if not already loaded
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }

        const initPlayer = () => {
            if (!containerRef.current) return;
            // Clean previous instance if exists in this container (though React usually handles DOM)
            
            playerRef.current = new window.YT.Player(containerRef.current, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    'playsinline': 1,
                    'autoplay': 1,
                    'controls': 1,
                },
                events: {
                    'onReady': (event: any) => {
                         event.target.playVideo();
                    }
                }
            });
        };

        if (window.YT && window.YT.Player) {
            initPlayer();
        } else {
            window.onYouTubeIframeAPIReady = () => {
                initPlayer();
            };
        }

        return () => {
            if (playerRef.current && playerRef.current.destroy) {
                try {
                    playerRef.current.destroy();
                } catch(e) { }
            }
        };
    }, [videoId]);

    // Handle Commands
    useEffect(() => {
        if (!playerRef.current || !command || !playerRef.current.getPlayerState) return;

        try {
            switch (command.action) {
                case 'pause':
                    playerRef.current.pauseVideo();
                    break;
                case 'play':
                    playerRef.current.playVideo();
                    break;
                case 'stop':
                    playerRef.current.stopVideo();
                    break;
                case 'forward':
                    const curTimeFwd = playerRef.current.getCurrentTime();
                    playerRef.current.seekTo(curTimeFwd + 10, true);
                    break;
                case 'rewind':
                    const curTimeRew = playerRef.current.getCurrentTime();
                    playerRef.current.seekTo(Math.max(0, curTimeRew - 10), true);
                    break;
            }
        } catch (e) {
            console.error("YouTube Player Command Error", e);
        }
    }, [command]);

    return (
        <div className="w-full h-full bg-black">
            <div ref={containerRef} className="w-full h-full"></div>
        </div>
    );
};