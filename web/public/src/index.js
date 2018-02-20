import _ from 'lodash';
import React, { Component } from 'react';
import  { PageHeader } from 'react-bootstrap';
import ReactDOM from 'react-dom';
import SearchBar from './components/search_bar';
import VideoList from './components/video_list';
import VideoDetail from './components/video_detail';

const BACKEND_ENDPOINT = '/discovery'
const ESTADO_INICIAL = 'inicial';
const ESTADO_BUSCANDO = 'buscando';
class App extends Component {

    constructor(props){
        super(props);
        this.state = {
            videos: [],
            selectedVideo: null,
            estado: ESTADO_INICIAL
        };
        this.videoSearch('', '');
    }

    videoSearch(term, type) {
      const parameters = {  method: 'POST',
                            headers: {
                              'Accept': 'application/json',
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              text: term,
                              type: type,
                            })
                          };
      fetch(BACKEND_ENDPOINT, parameters)
       .then((response) => {
         return response.json()
       })
       .then((json) => {
            this.setState({
                videos: json,
                selectedVideo: json[0],
                estado: ((term)?ESTADO_BUSCANDO:ESTADO_INICIAL)
             });
      });
    }

    render(){
        const videoSearch = _.debounce((term, type) => { this.videoSearch(term, type) }, 400);
        return (
            <div>
                <PageHeader>
                  Busca Cognitiva <small> <a href="https://github.com/placerda/busca-cognitiva">https://github.com/placerda/busca-cognitiva</a> </small>
                </PageHeader>
                <SearchBar onSearchTermChange={videoSearch} />
                <VideoDetail video={this.state.selectedVideo} estado={this.state.estado}/>
                <VideoList
                    onVideoSelect={selectedVideo => this.setState({selectedVideo}) }
                    videos={this.state.videos} />
            </div>
        );
    }

}

ReactDOM.render(<App />, document.querySelector('.container'));
