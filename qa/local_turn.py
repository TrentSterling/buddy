"""Loopback-only TURN/TCP test fixture, NOT a deployable TURN service.

The managed test browser forbids direct UDP ICE candidates. This fixture uses
its permitted TURN/TCP path without changing browser policies. It forwards only
between allocations made by this process on 127.0.0.1. Browser DTLS/SCTP and data
channels remain real. Never bind this fixture to a public interface.
"""
import asyncio,struct,socket,hashlib,hmac,secrets,json
COOKIE=0x2112A442
REALM=b'buddy-test'; USER=b'buddy'; PASSWORD=b'local-only'
KEY=hashlib.md5(USER+b':'+REALM+b':'+PASSWORD).digest()
COUNTS={'allocations':0,'tcp_clients':0,'forwarded_packets':0,'forwarded_bytes':0,'requests':{}}
ALLOCATIONS=set()
def attr(t,b):return struct.pack('!HH',t,len(b))+b+b'\0'*((-len(b))%4)
def attrs(payload):
 out={};i=0
 while i+4<=len(payload):
  t,n=struct.unpack_from('!HH',payload,i);out[t]=payload[i+4:i+4+n];i+=4+((n+3)//4)*4
 return out
def xoraddr(address):
 ip,port=address[:2];return struct.pack('!BBHI',0,1,port^(COOKIE>>16),struct.unpack('!I',socket.inet_aton(ip))[0]^COOKIE)
def unxor(b):
 _,fam,p,ip=struct.unpack('!BBHI',b[:8]);return (socket.inet_ntoa(struct.pack('!I',ip^COOKIE)),p^(COOKIE>>16))
def msg(t,tid,payload=b'',signed=False):
 head=struct.pack('!HHI12s',t,len(payload)+(24 if signed else 0),COOKIE,tid)
 if signed:payload+=attr(8,hmac.new(KEY,head+payload,hashlib.sha1).digest())
 return head+payload
class Relay(asyncio.DatagramProtocol):
 def __init__(self,owner):self.owner=owner
 def connection_made(self,t):self.transport=t
 def datagram_received(self,data,addr):
  o=self.owner
  if o.writer.is_closing() or addr not in ALLOCATIONS:return
  if addr not in o.allowed:return
  channel=o.reverse.get(addr)
  if channel:
   o.writer.write(struct.pack('!HH',channel,len(data))+data+b'\0'*((-len(data))%4))
  else:o.writer.write(msg(0x0017,secrets.token_bytes(12),attr(0x12,xoraddr(addr))+attr(0x13,data)))
  COUNTS['forwarded_packets']+=1;COUNTS['forwarded_bytes']+=len(data)
class Client:
 def __init__(self,reader,writer):self.reader=reader;self.writer=writer;self.nonce=secrets.token_hex(12).encode();self.transport=None;self.channels={};self.reverse={};self.allowed=set();self.addr=None
 def respond(self,t,tid,payload=b'',signed=True):self.writer.write(msg(t,tid,payload,signed))
 async def run(self):
  COUNTS['tcp_clients']+=1
  try:
   while True:
    first=await self.reader.readexactly(4);typ,n=struct.unpack('!HH',first)
    if 0x4000<=typ<=0x7fff:
     data=await self.reader.readexactly(((n+3)//4)*4);addr=self.channels.get(typ)
     if self.transport and addr in ALLOCATIONS:self.transport.sendto(data[:n],addr)
     continue
    rest=await self.reader.readexactly(16);cookie,tid=struct.unpack('!I12s',rest)
    if cookie!=COOKIE or n>65500:break
    body=await self.reader.readexactly(n);a=attrs(body);COUNTS['requests'][hex(typ)]=COUNTS['requests'].get(hex(typ),0)+1
    if typ==0x16:
     addr=unxor(a[0x12]);data=a.get(0x13,b'')
     if self.transport and addr in ALLOCATIONS and addr in self.allowed:self.transport.sendto(data,addr)
     continue
    if typ in (3,4,8,9) and 6 not in a:
     self.respond(typ|0x110,tid,attr(9,b'\0\0\4\1Unauthorized')+attr(0x14,REALM)+attr(0x15,self.nonce),False);continue
    if typ==3:
     if self.transport is None:
      loop=asyncio.get_running_loop();self.transport,_=await loop.create_datagram_endpoint(lambda:Relay(self),local_addr=('127.0.0.1',0));self.addr=self.transport.get_extra_info('sockname');ALLOCATIONS.add(self.addr);COUNTS['allocations']+=1
     self.respond(0x103,tid,attr(0x16,xoraddr(self.addr))+attr(0x20,xoraddr(self.writer.get_extra_info('peername')))+attr(0xd,struct.pack('!I',600)))
    elif typ==4:self.respond(0x104,tid,attr(0xd,struct.pack('!I',600)))
    elif typ==8:
     if 0x12 in a:
      peer=unxor(a[0x12]);self.allowed.add(peer)
     self.respond(0x108,tid)
    elif typ==9:
     addr=unxor(a[0x12]);channel=struct.unpack('!H',a[0xc][:2])[0];self.channels[channel]=addr;self.reverse[addr]=channel;self.allowed.add(addr);self.respond(0x109,tid)
    elif typ==1:self.respond(0x101,tid,attr(0x20,xoraddr(self.writer.get_extra_info('peername'))),False)
    await self.writer.drain()
  except (asyncio.IncompleteReadError,ConnectionResetError,BrokenPipeError):pass
  except Exception as e:print('TURN ERROR',repr(e),flush=True)
  finally:
   if self.addr:ALLOCATIONS.discard(self.addr)
   if self.transport:self.transport.close()
   self.writer.close()
async def start(port=34780):
 return await asyncio.start_server(lambda r,w:Client(r,w).run(),'127.0.0.1',port)
if __name__=='__main__':
 async def main():
  server=await start();print('TURN TCP 127.0.0.1:34780',flush=True)
  async with server:await server.serve_forever()
 asyncio.run(main())
