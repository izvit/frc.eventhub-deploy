import React from 'react'

type Props = {
  name: string
}

export default function Hello({ name }: Props) {
  return (
    <div className="hello">
      <p>Hello, {name} 👋</p>
    </div>
  )
}
