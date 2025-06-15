const information = document.getElementById('info')
information.innerText = `This app is using Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), and Electron (v${window.versions.electron()})`
console.log('run renderer');

const func = async () => {
    console.log('run func');
    
    const response = await window.versions.ping()
    console.log(response) // 打印 'pong'
}

func()