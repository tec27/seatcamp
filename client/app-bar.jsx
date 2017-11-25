import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'

const AppBarContainer = styled.div`
  background-color: #F06292;
  color: #ffffff;
  height: 56px;
  display: flex;
  padding-left: 24px;
  padding-right: 24px;
  justify-content: space-between;
  align-items: center;
`

const Title = styled.h1`
  color: #ffffff;
  font-size: 20px;
  font-weight: 500;
  margin: 0;
`

const UserCount = styled.p`
`

class AppBar extends React.Component {
  render() {
    return <AppBarContainer>
      <Title>meatspace</Title>
      <UserCount>{this.props.activeUsers.users}</UserCount>
    </AppBarContainer>
  }
}

export default connect(state => ({ activeUsers: state.activeUsers }))(AppBar)
