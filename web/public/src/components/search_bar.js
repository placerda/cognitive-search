import React, { Component } from 'react';
import  { Popover, FormGroup, FormControl, ControlLabel, OverlayTrigger } from 'react-bootstrap';

class SearchBar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
          term : '',
          type : ''
        };
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e) {
    if (e.target.id == 'term')
      this.onInputChange(e.target.value, this.state.type)
    else if (e.target.id == 'type') {
      this.onInputChange(this.state.term, e.target.value)
    }
  }

  onInputChange(term, type){
      this.setState({
          term: term,
          type: type
        });
      this.props.onSearchTermChange(term, type);
    }

  render() {

    const popoverBottom = (
      <Popover id="popover-positioned-bottom" title="Exemplos de Busca">
          <p>termo: Palmeiras / tipo: Organização</p>
          <p>termo: Copa do Mundo / tipo: Evento</p>
          termo: Neymar / tipo: Pessoa
      </Popover>
    );

    return (

      <form>
      <OverlayTrigger placement="bottom" overlay={popoverBottom}>
        <FormGroup  controlId="term">
            <FormControl
              type="text"
              value={this.state.term}
              placeholder="Digite o termo de busca aqui"
              onChange={this.handleChange}
            />
        </FormGroup>
      </OverlayTrigger>
        <FormGroup controlId="type">
          <FormControl componentClass="select" onChange={this.handleChange}>
            <option value="">Selecione o tipo de entidade</option>
            <option value="ORGANIZATION">Organização</option>
            <option value="EVENTS">Evento</option>
            <option value="PERSON">Pessoa</option>
            <option value="SPORT">Esporte</option>
          </FormControl>
        </FormGroup>
      </form>

    );
  }
}

export default SearchBar;
