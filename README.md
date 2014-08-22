# statsd-ganglia-backend

[![Build Status](https://secure.travis-ci.org/jbuchbinder/statsd-ganglia-backend.png)](http://travis-ci.org/jbuchbinder/statsd-ganglia-backend)

StatsD Ganglia publisher backend

## Installation

```
cd /usr/local/lib/node_modules/statsd
npm install statsd-ganglia-backend
```

Note that this backend does not have multicast support. You must 
configure a non-multicast UDP listener in your gmond.conf:

```
/* Plain old UDP, no mcast. */
udp_recv_channel { 
  port = 8650
} 
```

and configure this backend to send messages to that port.


## License

```
Copyright Jeff Buchbinder, and other contributors. All rights reserved.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
```

