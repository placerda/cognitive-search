import React from 'react';

const ESTADO_INICIAL = 'inicial';
const ESTADO_BUSCANDO = 'buscando';
const VideoDetail = ({video, estado}) => {

    if (!video) {
      if (estado == ESTADO_INICIAL)
        return <div></div>
      else
         return <div className="buscando">Buscando ...</div>
    }

    const videoId = video.snippet.resourceId.videoId;
    const url = `https://www.youtube.com/embed/${videoId}`;

    return (
        <div className="video-detail col-md-8">
            <div className="embed-responsive embed-responsive-16by9">
                <iframe className="embed-responsive-item" src={url}></iframe>
            </div>
            <div className="details">
                <div>{video.snippet.title}</div>
                <div>{video.snippet.descrition}</div>
            </div>
        </div>
    )
};

export default VideoDetail;
