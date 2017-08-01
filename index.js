const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const request = require('request');
const token = 'MzQwOTUzNTI3MzA2MTU4MDgw.DF6BPA.QqsHjHQPLnzVU8-RbuMpp5fScBI';

var stats = require('./stats.json');
var captcha_id, timerId, board, thread, started, timerCaptcha, bump_num;

var work_channel = 'gaming';

function get_captcha(message) {
  request(`https://2ch.hk/api/captcha/2chaptcha/id?board=${board}&thread=${thread}`, function (error, response, body) {
  captcha_id = JSON.parse(body)['id'];
  request(`https://2ch.hk/api/captcha/2chaptcha/image/${captcha_id}`)
    .pipe(fs.createWriteStream('captcha.png'))
    .on('finish', () => {
      message.channel.send(undefined, {files: ['captcha.png']});
      timerCaptcha = setTimeout(function() {
        message.channel.send(`Капча не разгадана за 60 секунд, останавливаем бампалку...`);
        stop_bump(message)
      }, 60 * 1000);
    });
  });
}
function stop_bump(message) {
  clearTimeout(timerId);
  clearTimeout(timerCaptcha);
  started = null;
  bump_num == 0;
  message.channel.send(`Остановлен авто-бамп для треда https://2ch.hk/${board}/res/${thread}.html`);
}
function declOfNum(n, titles) {
  return titles[plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)];
}
function write_stats(){
  fs.writeFile('stats.json', JSON.stringify(stats), function (error) {
    if (error) { console.error(`Ошибка записи stats.json: ${error}`); }
  });
}
function buy_img(message, folder){
  if (!stats[message.author.username]) { return message.author.send(`У вас недостаточно метакоинов для выполнения команды`); }
  if (stats[message.author.username] >= 5) {
    fs.readdir(`./${folder}`, (error, files) => {
      let img = files[Math.floor(Math.random()*files.length)];
      message.author.send(undefined, {files: [`./${folder}/${img}`]});
      message.channel.send(`${message.author.username} только что приобрел фото из пака "${folder}" за 5 метакоинов`);
      stats[message.author.username] -= 5;
      write_stats()
    });
  } else { return message.author.send(`У вас недостаточно метакоинов для выполнения команды`); }
}
function buy(message,cost){
  if (!stats[message.author.username]) {
    message.author.send(`У вас недостаточно метакоинов для выполнения команды`);
    return false;
  }
  if (stats[message.author.username] >= cost) {
    stats[message.author.username] -= cost;
    write_stats()
    return true;
  } else {
    message.author.send(`У вас недостаточно метакоинов для выполнения команды`);
    return false;
  }
}

client.on('ready', () => {
  console.log('I am ready!');
});

client.on('message', message => {
  if (message.channel.name !== work_channel) { return }
  if (/^(?:start \w+ \d{6,9} \d{1,3})$/.test(message.content)) {
    if (started) { return message.channel.send(`Бампалка уже запущена для треда https://2ch.hk/${board}/res/${thread}.html`); }
    let start_args = message.content.split(' ');
    board = start_args[1];
    thread = start_args[2];
    bump_num = start_args[3];
    if (buy(message,bump_num / 2 | 0) == false) { return; }
    message.channel.send(`Запущен авто-бамп для треда https://2ch.hk/${board}/res/${thread}.html с количеством бампов: ${bump_num}`);
    get_captcha(message)
    started = true;
  } else if (/^(?:\d{6})$/.test(message.content)) {
    if (started == null) { return message.channel.send(`Бампалка еще не запущена`); }
    fs.readdir('./pack', (error, files) => {
      let image = files[Math.floor(Math.random()*files.length)];
      var formData = {
        'task': 'post',
        'board': board,
        'thread': thread,
        'captcha_type': '2chaptcha',
        '2chaptcha_id': captcha_id,
        '2chaptcha_value': message.content,
        'image': {
          value: fs.createReadStream(`./pack/${image}`),
          options: {
            filename: 'CP.webm',
            contentType: 'image/jpeg'
          }
        }
      };
      request.post({url:'https://2ch.hk/makaba/posting.fcgi?json=1', formData: formData}, function (error, response, body) {
        request_response = JSON.parse(body);
        if (error) { return message.channel.send(`Бамп прошел с ошибкой: ${error}`); }
        if (request_response['Error']) {
          if (request_response['Error'] === -3) {
            message.channel.send(`Бамп прошел с ошибкой: ${body}`)
            return stop_bump(message);
          } else {
            return message.channel.send(`Бамп прошел с ошибкой: ${body}`);
          }
        }
        clearTimeout(timerCaptcha);
        stats[message.author.username] = stats[message.author.username] ? stats[message.author.username]+1 : 1;
        write_stats()
        if ((bump_num--) <= 1) {
          message.channel.send(`Бамп от ${message.author.username} прошел успешно. Количество бампов закончилось, останавливаем бапалку...`);
          stop_bump(message)
          return;
        }
        message.channel.send(`Бамп от ${message.author.username} прошел успешно, достаем следующую капчу`);
        timerId = setTimeout(get_captcha, 20*1000, message);
      });
    });
  } else if (/^(?:stats ?.*)$/.test(message.content)) {
    if (message.content == 'stats') {
      let stats_output = '```Топ 10 Metacoin кошельков:\n\n';
      let stats_arr = [];
      for (var i in stats) { stats_arr.push([i, stats[i]]); }
      stats_arr = stats_arr.sort( function(a,b) { return b[1] - a[1]; } ).slice(0,10);
      for (var i in stats_arr) {
        stats_output = (stats_output ? stats_output : '') + `${stats_arr[i][0]}${'.'.repeat(40-stats_arr[i][0].length)}${stats_arr[i][1]} ${declOfNum(stats_arr[i][1], ['метакоин','метакоина','метакоинов'])}\n`;
      }
      stats_output += '```';
      message.author.send(stats_output);

    } else if (/^(?:stats [a-zA-Zа-яА-Я0-9 ]+)$/.test(message.content)) {
      one_person_stat = message.content.split(' ').slice(1).join(' ');
      if (stats[one_person_stat]) {
        let stats_output = '```Статистика Metacoin кошелька для ' + one_person_stat + ':\n\n';
        stats_output += `${one_person_stat}${'.'.repeat(40-one_person_stat.length)}${stats[one_person_stat]}\n`;
        stats_output += '```';
        message.author.send(stats_output);
      }
    }
  } else if (/^(?:buy \w+)$/.test(message.content)) {
    if (message.content == 'buy celes') {
      buy_img(message, 'celes')
    } else if (message.content == 'buy cp') {
      buy_img(message, 'cp')
    }
  } else if (/^(?:thread)$/.test(message.content)) {
    if (started) {
      return message.author.send(`Бампалка запущена для треда https://2ch.hk/${board}/res/${thread}.html`);
    } else {
      message.author.send(`Бампалка еще не запущена`);
    }
  } else if (/^(?:help)$/.test(message.content)) {
    message.author.send('\n \
```\n \
Команды автобампалки:\n\n \
  start <board> <threadnum> <bump_num> - запуск автобампалки для треда (пример: start b 1513513 10, стоит 5 метакоинов)\n \
  stop - остановка текущего автобампа (стоит 15 метакоинов)\n \
  stats - топ 10 метакоин кошельков\n \
  buy celes|cp - покупка картинки из пака celes|cp (стоимость 5 метакоинов)\n \
  thread - высылает в ЛС ссылку на активный тред\n \
```\n \
    ')
  } else if (/^(?:stop)$/.test(message.content)) {
    if (buy(message,15) == false) { return; }
    stop_bump(message)
  }
});

// Log our bot in
client.login(token);
